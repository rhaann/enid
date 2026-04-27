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

  try {
    const { data: auditInput } = await supabase()
      .from("dlb_audit_inputs")
      .select("name, created_at, status")
      .eq("id", id)
      .maybeSingle();

    const [brandResult, websiteResult, socialResult, competitorResult] = await Promise.allSettled([
      supabase()
        .from("dlb_brand_eval_results")
        .select("*")
        .eq("dlb_audit_input_id", id)
        .single(),
      supabase()
        .from("dlb_website_eval_results")
        .select("*")
        .eq("dlb_audit_inputs_id", id)
        .single(),
      supabase()
        .from("dlb_social_media_agent_results")
        .select("*")
        .eq("audit_input_id", id),
      supabase()
        .from("dlb_competitor_agent_results")
        .select("*")
        .eq("dlb_audit_inputs_id", id),
    ]);

    let merged: Record<string, unknown> = {};
    let hasAnyData = false;

    // Brand results (single row)
    if (brandResult.status === "fulfilled" && brandResult.value.data) {
      const { dlb_audit_input_id, id: _rowId, created_at, ...fields } = brandResult.value.data;
      merged = { ...merged, ...fields };
      hasAnyData = true;
    }

    // Website results (single row)
    if (websiteResult.status === "fulfilled" && websiteResult.value.data) {
      const { dlb_audit_inputs_id, id: _rowId, created_at, ...fields } = websiteResult.value.data;
      merged = { ...merged, ...fields };
      hasAnyData = true;
    }

    // Social media results (multiple rows — one per platform)
    if (socialResult.status === "fulfilled" && socialResult.value.data?.length) {
      const rows = socialResult.value.data;
      hasAnyData = true;

      if (rows.length === 1) {
        const { audit_input_id, id: _rowId, created_at, ...fields } = rows[0];
        merged = { ...merged, ...fields };
      } else {
        const platformScores: Record<string, unknown> = {};
        const platformsAnalyzed: string[] = [];
        let overallEval: unknown = null;

        for (const row of rows) {
          const name =
            row.platform_type ?? row.platform ?? `Platform ${platformsAnalyzed.length + 1}`;
          platformsAnalyzed.push(name);
          platformScores[name] = row;
          if (!overallEval && (row.overal_evaluation || row.overall_evaluation)) {
            overallEval = row.overal_evaluation ?? row.overall_evaluation;
          }
        }

        merged = {
          ...merged,
          platform_scores: platformScores,
          platforms_analyzed: platformsAnalyzed,
          ...(overallEval ? { overal_evaluation: overallEval } : {}),
        };
      }
    }

    // Competitor results (multiple rows — one per competitor)
    if (competitorResult.status === "fulfilled" && competitorResult.value.data?.length) {
      const rows = competitorResult.value.data;
      hasAnyData = true;

      if (rows.length === 1 && rows[0].company_name) {
        const { dlb_audit_inputs_id, id: _rowId, created_at, ...fields } = rows[0];
        merged = { ...merged, ...fields };
      } else if (rows.length > 0 && rows[0].company_name) {
        const competitorData: Record<string, unknown> = {};
        const competitorsAnalyzed: string[] = [];

        for (const row of rows) {
          const name = row.company_name ?? `Competitor ${competitorsAnalyzed.length + 1}`;
          competitorsAnalyzed.push(name);
          competitorData[name] = row;
        }

        merged = {
          ...merged,
          competitor_data: competitorData,
          competitors_analyzed: competitorsAnalyzed,
        };
      }
    }

    if (!hasAnyData) {
      return Response.json(
        { error: "No audit results found for this ID." },
        { status: 404 }
      );
    }

    return Response.json({
      data: merged,
      companyName: auditInput?.name || null,
      createdAt: auditInput?.created_at || null,
      status: auditInput?.status || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch audit results.";
    console.error("[audit-results] Error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
