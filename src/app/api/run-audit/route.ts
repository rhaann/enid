export const dynamic = "force-dynamic";
// Needs to outlive the evaluator (up to 300s) plus a small dispatch window.
export const maxDuration = 300;

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

  if (audit.status !== null) {
    return Response.json(
      { error: "This audit has already been started. Reset it first to run again." },
      { status: 409 }
    );
  }

  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const appUrl = `${proto}://${host}`;

  const internalHeaders = {
    "Content-Type": "application/json",
    "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
  };
  const agentPayload = JSON.stringify({ audit_input_id: auditId });

  // This after() callback is the single orchestrator for the full audit pipeline.
  //
  // Why here and not inside the evaluator:
  //   On Vercel, a serverless function is terminated as soon as it sends its
  //   response. Fire-and-forget fetch() calls inside the evaluator get killed
  //   before they are dispatched. run-audit's after() context stays alive (via
  //   Vercel waitUntil) so we can safely dispatch downstream agents from here
  //   after the evaluator has finished.
  //
  // Flow:
  //   1. Await evaluator — this blocks until brand + website eval are saved to DB.
  //   2. Fire competitor and social agents without awaiting their full responses
  //      (each runs up to 300s as its own independent serverless invocation).
  //   3. Hold 3s so Node.js can establish TCP connections and send the request
  //      bytes before this callback exits and the function terminates.
  after(async () => {
    // Step 1: run evaluator to completion
    let evaluatorOk = false;
    try {
      const res = await fetch(`${appUrl}/api/evaluator_agent`, {
        method: "POST",
        headers: internalHeaders,
        body: agentPayload,
      });
      evaluatorOk = res.ok;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[run-audit] Evaluator returned ${res.status}:`, text.slice(0, 300));
      }
    } catch (err) {
      console.error("[run-audit] Evaluator fetch threw:", err);
    }

    if (!evaluatorOk) return;

    // Step 2: fire competitor and social — no await on full responses
    console.log("[run-audit] Dispatching competitor and social agents");
    fetch(`${appUrl}/api/competitor_agent`, {
      method: "POST",
      headers: internalHeaders,
      body: agentPayload,
    }).catch((err) => console.error("[run-audit] Competitor dispatch failed:", err));

    fetch(`${appUrl}/api/social_media_agent`, {
      method: "POST",
      headers: internalHeaders,
      body: agentPayload,
    }).catch((err) => console.error("[run-audit] Social dispatch failed:", err));

    // Step 3: hold long enough for TCP + request bytes to be sent
    await new Promise((resolve) => setTimeout(resolve, 3000));
  });

  return Response.json({ success: true });
}
