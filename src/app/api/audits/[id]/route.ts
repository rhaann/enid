export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/auth";

const RELATED_TABLES: { table: string; column: string }[] = [
  { table: "dlb_brand_eval_results", column: "dlb_audit_input_id" },
  { table: "dlb_website_eval_results", column: "dlb_audit_inputs_id" },
  { table: "dlb_social_media_agent_results", column: "audit_input_id" },
  { table: "dlb_competitor_agent_results", column: "dlb_audit_inputs_id" },
  { table: "dlb_audit_scraped_websites", column: "dlb_audit_inputs_id" },
  { table: "dlb_snapshot_results", column: "audit_input_id" },
  { table: "workflow_runs", column: "audit_input_id" },
  { table: "assets", column: "audit_input_id" },
];

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_FIELDS: Record<string, string> = {
  companyName: "name",
  companyDomain: "url",
  clientEmail: "email",
  objectives: "objective",
  companyStage: "company_stage",
  companySize: "company_size",
  industry: "industry",
  businessGoals: "business_goals",
  linkedin: "linkedin_url",
  twitter: "x_url",
  facebook: "facebook_url",
  instagram: "instagram_url",
  pinterest: "pinterest_url",
  youtube: "youtube_url",
  tiktok: "tiktok_url",
  competitorWebsites: "competitor_urls",
  location: "location",
  targetLocation: "target_location",
  notes: "admin_notes",
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  for (const [frontendKey, dbColumn] of Object.entries(ALLOWED_FIELDS)) {
    if (frontendKey in body) {
      updates[dbColumn] = body[frontendKey];
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("dlb_audit_inputs")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[audits/patch] Supabase update error:", error);
    return Response.json({ error: "Failed to update audit." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  // Delete storage assets first
  const { data: assets } = await supabaseAdmin
    .from("assets")
    .select("storage_path")
    .eq("audit_input_id", id);

  const storagePaths = ((assets ?? []) as { storage_path: string }[])
    .map((a) => a.storage_path)
    .filter(Boolean);

  if (storagePaths.length > 0) {
    await supabaseAdmin.storage.from("brand-assets").remove(storagePaths);
  }

  // Delete all related rows
  for (const { table, column } of RELATED_TABLES) {
    await supabaseAdmin.from(table).delete().eq(column, id);
  }

  // Delete the audit input row itself
  const { error } = await supabaseAdmin
    .from("dlb_audit_inputs")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[audits/delete] Supabase error:", error);
    return Response.json({ error: "Failed to delete audit." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
