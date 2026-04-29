export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Audit ID is required." }, { status: 400 });
  }

  // Overall audit status
  const { data: auditData } = await supabase()
    .from("dlb_audit_inputs")
    .select("status, error_message")
    .eq("id", id)
    .maybeSingle();

  // Per-step progress rows — each agent step inserts its own workflow_runs row
  const { data: runs } = await supabase()
    .from("workflow_runs")
    .select("workflow_name, status")
    .eq("audit_input_id", id)
    .order("created_at", { ascending: true });

  const workflows: Record<string, string> = {};
  for (const run of runs ?? []) {
    workflows[run.workflow_name] = run.status;
  }

  const raw = (auditData?.status ?? "").toLowerCase();
  const topStatus = raw === "done" ? "Done" : raw === "failed" ? "Failed" : "In Progress";

  return Response.json({
    status: topStatus,
    workflows,
    errorMessage: auditData?.error_message ?? null,
    source: "db",
  });
}
