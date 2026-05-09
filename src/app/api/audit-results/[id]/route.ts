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

    // Social media results — one row per platform in dlb_social_media_agent_results.
    // The overal_evaluation column on each row holds the full cross-platform JSON.
    if (socialResult.status === "fulfilled" && socialResult.value.data?.length) {
      const rows = socialResult.value.data;
      hasAnyData = true;

      const platformScores: Record<string, unknown> = {};
      const platformsAnalyzed: string[] = [];

      for (const row of rows) {
        const name = row.platform_type ?? `Platform ${platformsAnalyzed.length + 1}`;
        platformsAnalyzed.push(name);
        platformScores[name] = row;
      }

      merged = {
        ...merged,
        platform_scores: platformScores,
        platforms_analyzed: platformsAnalyzed,
      };

      // Parse cross-platform data from overal_evaluation on the first row
      const rawOveral = rows[0]?.overal_evaluation;
      if (rawOveral) {
        try {
          const overall = typeof rawOveral === "string" ? JSON.parse(rawOveral) : rawOveral;
          merged = {
            ...merged,
            cross_platform_scores: overall.cross_platform_scores ?? null,
            overall_assessment: overall.overall_assessment ?? null,
            ninety_day_action_plan: overall.ninety_day_action_plan ?? null,
            executive_narrative: overall.executive_narrative ?? null,
          };
        } catch {
          // overal_evaluation is not parseable JSON — skip cross-platform fields
        }
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

    // Fetch workflow runs ordered newest-first so we can determine the latest
    // state for each agent (an agent may have multiple rows if retried).
    const { data: workflowRuns } = await supabase()
      .from("workflow_runs")
      .select("workflow_name, status, error_message")
      .eq("audit_input_id", id)
      .in("status", ["In Progress", "Failed"])
      .order("created_at", { ascending: false });

    const activeAgents: string[] = [];
    const errorByAgent: Record<string, string> = {};
    const seenAgents = new Set<string>();

    for (const run of workflowRuns ?? []) {
      // Only record the first (most recent) entry per agent name.
      if (!seenAgents.has(run.workflow_name)) {
        seenAgents.add(run.workflow_name);
        if (run.status === "In Progress") {
          activeAgents.push(run.workflow_name);
        } else if (run.status === "Failed") {
          errorByAgent[run.workflow_name] = run.error_message ?? "An unknown error occurred";
        }
      }
    }

    return Response.json({
      data: merged,
      companyName: auditInput?.name || null,
      createdAt: auditInput?.created_at || null,
      status: auditInput?.status || null,
      activeAgents,
      ...(errorByAgent["competitor-agent"] ? { competitor_error: errorByAgent["competitor-agent"] } : {}),
      ...(errorByAgent["social-media-agent"] ? { social_error: errorByAgent["social-media-agent"] } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch audit results.";
    console.error("[audit-results] Error:", msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
