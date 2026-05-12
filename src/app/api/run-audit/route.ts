export const dynamic = "force-dynamic";

import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const auditId = body?.id;

  if (!auditId) {
    return Response.json({ error: "Audit ID is required." }, { status: 400 });
  }

  const { data: audit, error: fetchError } = await supabase()
    .from("dlb_audit_inputs")
    .select("id, status")
    .eq("id", auditId)
    .single();

  if (fetchError || !audit) {
    return Response.json({ error: "Audit not found." }, { status: 404 });
  }

  // Only allow running when the audit has not been started yet (status is null).
  // Once started, the user must reset it before running again.
  if (audit.status !== null) {
    return Response.json(
      { error: "This audit has already been started. Reset it first to run again." },
      { status: 409 }
    );
  }

  // Mark as In Progress synchronously before after() fires.
  // This prevents the cron from picking up the same row again if it runs
  // before the evaluator agent has a chance to update the status itself.
  await supabase()
    .from("dlb_audit_inputs")
    .update({ status: "In Progress", status_updated_at: new Date().toISOString() })
    .eq("id", auditId);

  // Derive the base URL from the incoming request so this works in both
  // local dev and production without needing a NEXT_PUBLIC_APP_URL env var.
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const appUrl = `${proto}://${host}`;

  // Fire the evaluator agent AFTER this response is sent so the browser
  // gets an immediate acknowledgement while the agent runs in the background.
  after(async () => {
    try {
      await fetch(`${appUrl}/api/evaluator_agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
        },
        body: JSON.stringify({ audit_input_id: auditId }),
      });
    } catch (err) {
      console.error("[run-audit] Failed to trigger evaluator agent:", err);
    }
  });

  return Response.json({ success: true });
}
