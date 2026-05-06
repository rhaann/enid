export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/supabase/auth";

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
