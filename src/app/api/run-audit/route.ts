export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

export async function POST(req: Request) {
  // Only admin can trigger audits
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const webhookUrl = process.env.N8N_WORKFLOW_URL;
  if (!webhookUrl) {
    return Response.json({ error: "N8N_WORKFLOW_URL is not configured." }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => null);
    const auditId = body?.id;

    if (!auditId) {
      return Response.json({ error: "Audit ID is required." }, { status: 400 });
    }

    // Verify the audit exists in the database
    const { data: audit, error: fetchError } = await supabase()
      .from("dlb_audit_inputs")
      .select("id")
      .eq("id", auditId)
      .single();

    if (fetchError || !audit) {
      return Response.json({ error: "Audit not found." }, { status: 404 });
    }

    console.log(`[run-audit] Triggering n8n workflow for audit ${auditId}`);

    // Fire the main n8n webhook with just the audit ID.
    // n8n looks up the audit data from the DB, determines the tier,
    // and decides which sub-workflows to run (eval, social, competitor).
    // Workflow progress is tracked in the workflow_runs table.
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: auditId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[run-audit] n8n trigger failed: ${res.status} ${text}`);
      return Response.json({ error: "Failed to trigger audit workflow." }, { status: 500 });
    }

    // Return immediately — the client will poll /api/run-audit/status/[id]
    // to track per-workflow progress until all workflows are done.
    console.log(`[run-audit] n8n workflow triggered for audit ${auditId}`);
    return Response.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    console.error("[run-audit] Error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
