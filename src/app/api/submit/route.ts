export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const {
      companyName,
      websiteUrl,
      email,
      objectives,
      companyStage,
      companySize,
      industry,
      businessGoals,
      targetLocation,
      competitorUrls,
      social,
      logoFiles,
    } = body;

    if (!companyName || !websiteUrl || !email) {
      return Response.json(
        { error: "Company name, website URL, and email are required." },
        { status: 400 }
      );
    }

    const { data: auditInput, error: insertError } = await supabase()
      .from("dlb_audit_inputs")
      .insert({
        name: companyName,
        url: websiteUrl,
        email,
        objective: Array.isArray(objectives) && objectives.length > 0 ? objectives : null,
        company_stage: companyStage || null,
        company_size: companySize || null,
        industry: industry || null,
        target_location: targetLocation || null,
        competitor_urls: Array.isArray(competitorUrls) && competitorUrls.length > 0 ? competitorUrls : null,
        business_goals: businessGoals || null,
        linkedin_url: social?.linkedin || null,
        x_url: social?.twitter || null,
        facebook_url: social?.facebook || null,
        instagram_url: social?.instagram || null,
        pinterest_url: social?.pinterest || null,
        youtube_url: social?.youtube || null,
        tiktok_url: social?.tiktok || null,
        status: null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[submit] Supabase insert error:", insertError);
      return Response.json(
        { error: "Failed to save your submission. Please try again." },
        { status: 500 }
      );
    }

    // Insert logo file records into assets table (when uploads are enabled)
    if (Array.isArray(logoFiles) && logoFiles.length > 0 && auditInput?.id) {
      const assetRows = logoFiles.map((f: { name: string; size: number; type: string }) => ({
        audit_input_id: auditInput.id,
        file_name: f.name,
        file_type: f.type,
        file_size_bytes: f.size,
        storage_path: null,
      }));

      const { error: assetsError } = await supabase()
        .from("assets")
        .insert(assetRows);

      if (assetsError) {
        console.error("[submit] Assets insert error:", assetsError);
      }
    }

    return Response.json({ success: true, id: auditInput?.id });
  } catch (e) {
    console.error("[submit] Unexpected error:", e);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
