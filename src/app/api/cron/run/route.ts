/**
 * @file route.ts
 * POST /api/cron/run
 *
 * Vercel Cron Job — runs every 10 minutes.
 *
 * Two phases per invocation (one row each, processed via after()):
 *
 * Phase 1 — Trigger pending audits
 *   Finds the oldest row where scheduled_for <= now() AND status IS NULL.
 *   Synchronously marks it "In Progress", then fires the evaluator agent
 *   in the background. On agent failure: marks "Failed" + sends admin alert.
 *
 * Phase 2 — Send snapshot emails for completed audits
 *   Finds the oldest "Done" audit whose snapshot has not been emailed yet
 *   (dlb_snapshot_results.emailed_at IS NULL, or no snapshot row exists).
 *   Generates the snapshot PDF via the snapshot agent, emails it to the
 *   client (TEST_RECIPIENT in testing mode), then stamps emailed_at.
 *
 * Secured by CRON_SECRET — Vercel passes it automatically as
 * Authorization: Bearer {CRON_SECRET} when the cron fires.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSnapshotEmail, sendAdminFailureAlert } from "@/lib/email";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // ------------------------------------------------------------------
  // Auth: validate Vercel cron secret
  // ------------------------------------------------------------------
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ------------------------------------------------------------------
  // Clients
  // ------------------------------------------------------------------
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Derive app URL from the incoming request headers — works in both
  // local dev and Vercel without needing a hardcoded env var.
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const appUrl = `${proto}://${host}`;

  const internalHeaders = {
    "Content-Type": "application/json",
    "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
  };

  // Summaries returned in the response for observability
  let phase1: string = "skipped";
  let phase2: string = "skipped";

  // ------------------------------------------------------------------
  // Phase 1 — Trigger the oldest pending audit
  // ------------------------------------------------------------------
  const { data: pending } = await supabaseAdmin
    .from("dlb_audit_inputs")
    .select("id, name, url")
    .is("status", null)
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (pending) {
    // Mark In Progress synchronously — prevents double-triggering if the
    // cron fires again before the evaluator agent updates the status.
    await supabaseAdmin
      .from("dlb_audit_inputs")
      .update({
        status: "In Progress",
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", pending.id);

    phase1 = `triggered:${pending.id}`;

    after(async () => {
      try {
        const res = await fetch(`${appUrl}/api/evaluator_agent`, {
          method: "POST",
          headers: internalHeaders,
          body: JSON.stringify({ audit_input_id: pending.id }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(json.error ?? `Evaluator returned HTTP ${res.status}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[cron/phase1] Evaluator failed for ${pending.id}:`, msg);

        await supabaseAdmin
          .from("dlb_audit_inputs")
          .update({
            status: "Failed",
            error_message: msg,
            status_updated_at: new Date().toISOString(),
          })
          .eq("id", pending.id);

        await sendAdminFailureAlert(
          String(pending.name ?? "Unknown"),
          String(pending.url ?? ""),
          msg
        ).catch((e) => console.error("[cron/phase1] Brevo alert failed:", e));
      }
    });
  }

  // ------------------------------------------------------------------
  // Phase 2 — Email snapshot for the oldest completed audit not yet sent
  // ------------------------------------------------------------------

  // Fetch a small batch of Done audits, then find the first without an email.
  const { data: doneAudits } = await supabaseAdmin
    .from("dlb_audit_inputs")
    .select("id, name, url, email")
    .eq("status", "Done")
    .order("status_updated_at", { ascending: true })
    .limit(20);

  let auditForEmail: { id: string; name: string; url: string; email: string } | null = null;

  for (const audit of (doneAudits ?? [])) {
    const { data: snap } = await supabaseAdmin
      .from("dlb_snapshot_results")
      .select("id, emailed_at")
      .eq("audit_input_id", audit.id)
      .maybeSingle();

    // Send if: no snapshot row yet, or snapshot exists but was never emailed
    if (!snap || !snap.emailed_at) {
      auditForEmail = audit as { id: string; name: string; url: string; email: string };
      break;
    }
  }

  if (auditForEmail) {
    phase2 = `emailing:${auditForEmail.id}`;

    after(async () => {
      try {
        // Warm the snapshot cache — runs the full pipeline if needed, saves
        // synthesis to dlb_snapshot_results. We don't stream the PDF here;
        // the client downloads it on demand via /api/download/[auditId].
        const snapshotRes = await fetch(`${appUrl}/api/snapshot_agent`, {
          method: "POST",
          headers: internalHeaders,
          body: JSON.stringify({ audit_input_id: auditForEmail!.id }),
        });

        if (!snapshotRes.ok) {
          const json = await snapshotRes.json().catch(() => ({})) as { error?: string };
          throw new Error(json.error ?? `Snapshot agent returned HTTP ${snapshotRes.status}`);
        }

        // Build the public download link for the client email
        const downloadUrl = `${appUrl}/api/download/${auditForEmail!.id}`;

        // Send email with download button
        await sendSnapshotEmail(
          String(auditForEmail!.name ?? "Your Company"),
          String(auditForEmail!.email ?? ""),
          downloadUrl
        );

        // Stamp emailed_at
        await supabaseAdmin
          .from("dlb_snapshot_results")
          .update({ emailed_at: new Date().toISOString() })
          .eq("audit_input_id", auditForEmail!.id);

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[cron/phase2] Snapshot email failed for ${auditForEmail!.id}:`, msg);

        await sendAdminFailureAlert(
          String(auditForEmail!.name ?? "Unknown"),
          String(auditForEmail!.url ?? ""),
          `Snapshot generation / email failed: ${msg}`
        ).catch((e) => console.error("[cron/phase2] Brevo alert failed:", e));
      }
    });
  }

  // ------------------------------------------------------------------
  // Return summary for Vercel cron logs
  // ------------------------------------------------------------------
  return Response.json({ ok: true, phase1, phase2 });
}
