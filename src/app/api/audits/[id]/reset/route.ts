export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

const RESULT_TABLES: { table: string; column: string }[] = [
  { table: "dlb_brand_eval_results", column: "dlb_audit_input_id" },
  { table: "dlb_website_eval_results", column: "dlb_audit_inputs_id" },
  { table: "dlb_social_media_agent_results", column: "audit_input_id" },
  { table: "dlb_competitor_agent_results", column: "dlb_audit_inputs_id" },
  { table: "dlb_audit_scraped_websites", column: "dlb_audit_inputs_id" },
  { table: "workflow_runs", column: "audit_input_id" },
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  const { data: audit, error: fetchError } = await supabase()
    .from("dlb_audit_inputs")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !audit) {
    return Response.json({ error: "Audit not found." }, { status: 404 });
  }

  const status = (audit.status ?? "").toLowerCase();
  if (status !== "done" && status !== "failed") {
    return Response.json(
      { error: "Only done or failed audits can be reset." },
      { status: 400 }
    );
  }

  const errors: string[] = [];

  // Delete assets from storage bucket, then from DB
  const { data: assets } = await supabase()
    .from("assets")
    .select("storage_path")
    .eq("audit_input_id", id);

  const storagePaths = (assets ?? [])
    .map((a: any) => a.storage_path)
    .filter(Boolean);

  if (storagePaths.length > 0) {
    await supabase().storage.from("brand-assets").remove(storagePaths);
  }

  const { error: assetsDelErr } = await supabase()
    .from("assets")
    .delete()
    .eq("audit_input_id", id);

  if (assetsDelErr) {
    errors.push("assets");
  }

  for (const { table, column } of RESULT_TABLES) {
    const { error } = await supabase()
      .from(table)
      .delete()
      .eq(column, id);
    if (error) {
      errors.push(table);
    }
  }

  if (errors.length > 0) {
    return Response.json(
      { error: `Failed to clear results from: ${errors.join(", ")}. Please try resetting again.` },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase()
    .from("dlb_audit_inputs")
    .update({ status: null, error_message: null, status_updated_at: null })
    .eq("id", id);

  if (updateError) {
    console.error("[reset] Failed to reset audit status:", updateError);
    return Response.json(
      { error: "Results cleared but failed to reset status." },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
