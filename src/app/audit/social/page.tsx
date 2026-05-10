"use client";
import { useAudit } from "@/components/AuditProvider";
import { Presentation, type PresentationItem } from "@/components/Presentation";
import { VerticalTabs } from "@/components/VerticalTabs";
import type { SocialPlatformReport } from "@/lib/auditModel";
import { getScoreColor, getScoreLabel } from "@/lib/scoring";

const KNOWN_PLATFORMS = new Set([
  "linkedin", "twitter", "x", "facebook", "instagram",
  "youtube", "tiktok", "pinterest", "github", "threads",
  "reddit", "medium", "glassdoor", "crunchbase", "snapchat",
]);

export default function SocialMediaReportPage() {
  const { audit } = useAudit();
  const sm = audit.socialMediaReport;

  const scoreLabel = (score?: number) => getScoreLabel(score);

  if (!sm) {
    const errorMsg = audit.socialMediaError;
    const isLoading =
      (audit.activeAgents ?? []).includes("social-media-agent") ||
      audit.auditStatus === "In Progress";

    // Loading — agent is actively running
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm max-w-md w-full">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#17bfca]" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Analyzing Social Media</h2>
            <p className="text-zinc-500 text-sm mb-4">
              Reviewing your social presence across platforms. This usually takes 1–3 minutes.
            </p>
            <div className="w-full h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-[#17bfca] animate-pulse" />
            </div>
          </div>
        </div>
      );
    }

    // Failed — agent returned an error
    if (errorMsg) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="rounded-2xl border border-red-200 bg-white p-10 text-center shadow-sm max-w-md">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <span className="text-red-600 text-lg font-bold">!</span>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Social Media Audit Failed</h2>
            <p className="text-zinc-600 text-sm">{errorMsg}</p>
          </div>
        </div>
      );
    }

    // Nothing found — agent ran but returned no results
    return (
      <div className="flex items-center justify-center py-24">
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm max-w-md">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
            <span className="text-zinc-400 text-lg">—</span>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">No Social Media Data Found</h2>
          <p className="text-zinc-600 text-sm">
            The social media agent ran but could not find any active profiles for this company. Make sure social media URLs are visible on the website and try running the audit again.
          </p>
        </div>
      </div>
    );
  }

  const scoreColorStyle = (score: number) => ({ color: getScoreColor(score) });

  const buildCategoryTabs = (p: SocialPlatformReport) => {
    const categories: { label: string; data: { score: number; assessment: string } }[] = [
      { label: "Profile Completeness", data: p.profileCompleteness },
      { label: "Content Quality", data: p.contentQuality },
      { label: "Brand Alignment", data: p.brandAlignment },
      { label: "Audience Engagement", data: p.audienceEngagement },
      { label: "Posting Frequency", data: p.postingFrequency },
      { label: "Visual Consistency", data: p.visualConsistency },
    ].filter((cat) => cat.data);

    return categories.map((cat) => ({
      title: cat.label,
      rightMeta: (
        <div className="text-right">
          <div className="text-sm sm:text-base font-semibold leading-none" style={scoreColorStyle(cat.data.score)}>
            {cat.data.score}
          </div>
          <div className="text-[10px] sm:text-xs text-white/50 leading-none mt-0.5">
            {scoreLabel(cat.data.score)}
          </div>
        </div>
      ),
      content: (
        <p className="leading-relaxed">{cat.data.assessment}</p>
      ),
    }));
  };

  const renderPlatformExtras = (p: SocialPlatformReport) => (
    <div className="space-y-3 mt-3">
      {p.strengths.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1 text-[#64b5a0] text-sm">Strengths</h4>
          <ul className="list-disc pl-5 space-y-1">
            {p.strengths.map((item, i) => (
              <li key={i} className="text-sm text-white/80">{item}</li>
            ))}
          </ul>
        </div>
      )}
      {p.weaknesses.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1 text-[#e8a87c] text-sm">Weaknesses</h4>
          <ul className="list-disc pl-5 space-y-1">
            {p.weaknesses.map((item, i) => (
              <li key={i} className="text-sm text-white/80">{item}</li>
            ))}
          </ul>
        </div>
      )}
      {p.recommendations.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1 text-[#17bfca] text-sm">Recommendations</h4>
          <ul className="list-disc pl-5 space-y-1">
            {p.recommendations.map((item, i) => (
              <li key={i} className="text-sm text-white/80">{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const parsedEval = (() => {
    if (!sm?.overallEvaluation) {
      console.warn("[social] overallEvaluation is empty/null/undefined");
      return null;
    }
    console.log("[social] overallEvaluation type:", typeof sm.overallEvaluation,
      "| length:", typeof sm.overallEvaluation === "string" ? sm.overallEvaluation.length : "n/a",
      "| first 200 chars:", typeof sm.overallEvaluation === "string" ? sm.overallEvaluation.slice(0, 200) : JSON.stringify(sm.overallEvaluation).slice(0, 200));
    try {
      const parsed =
        typeof sm.overallEvaluation === "string"
          ? JSON.parse(sm.overallEvaluation)
          : sm.overallEvaluation;
      console.log("[social] parsedEval keys:", parsed && typeof parsed === "object" ? Object.keys(parsed) : "not an object");
      return parsed;
    } catch (e) {
      console.warn("[social] Failed to parse overallEvaluation:", e);
      return null;
    }
  })();

  const crossPlatformScores = parsedEval?.cross_platform_scores;
  const overallAssessment = parsedEval?.overall_assessment;
  const executiveNarrative = parsedEval?.executive_narrative;
  const ninetyDayActionPlan = parsedEval?.ninety_day_action_plan;

  const items: PresentationItem[] = [];

  // ── Card 1: Social Media Overview (trimmed) ──
  items.push({
    id: "social-overview",
    title: "Social Media Overview",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Platforms analyzed:{" "}
          <span className="text-white font-medium">
            {sm.platformsAnalyzed.join(", ")}
          </span>
        </p>

        {/* Platform score summary */}
        <div className="grid gap-2 sm:grid-cols-2">
          {sm.platformsAnalyzed.map((platform) => {
            const p = sm.platformScores[platform];
            if (!p) return null;
            return (
              <div
                key={platform}
                className="flex items-center justify-between rounded-lg bg-white/10 px-4 py-3"
              >
                <span className="font-medium text-white">{platform}</span>
                <span className="text-lg font-bold" style={scoreColorStyle(p.platformAverage)}>
                  {p.platformAverage}
                </span>
              </div>
            );
          })}
        </div>

        {/* Platform Priority */}
        {(() => {
          const validPriority = (overallAssessment?.platform_priority_ranking ?? [])
            .filter((e: any) => KNOWN_PLATFORMS.has(String(e.platform).trim().toLowerCase()));
          if (validPriority.length === 0) return null;
          return (
            <div>
              <h4 className="font-semibold mb-2 text-white/90">Platform Priority</h4>
              <div className="space-y-2">
                {validPriority.map((entry: any, idx: number) => (
                  <div key={entry.platform} className="rounded-lg bg-white/10 p-3 flex gap-3">
                    <span className="text-lg font-bold text-[#17bfca]">#{idx + 1}</span>
                    <div>
                      <span className="text-sm font-semibold text-white">{entry.platform}</span>
                      <p className="text-xs text-white/70">{entry.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Executive Summary */}
        {executiveNarrative && (
          <div className="bg-white/5 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold mb-2 text-[#17bfca]">Executive Summary</h4>
            {executiveNarrative.presence_health && (
              <div>
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Presence Health
                </span>
                <p className="text-sm text-white/80 leading-relaxed mt-1">
                  {executiveNarrative.presence_health}
                </p>
              </div>
            )}
            {executiveNarrative.consistency_analysis && (
              <div>
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Consistency
                </span>
                <p className="text-sm text-white/80 leading-relaxed mt-1">
                  {executiveNarrative.consistency_analysis}
                </p>
              </div>
            )}
            {executiveNarrative.resource_allocation && (
              <div>
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                  Resource Allocation
                </span>
                <p className="text-sm text-white/80 leading-relaxed mt-1">
                  {executiveNarrative.resource_allocation}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fallback: if overallEvaluation is a plain string (not JSON) */}
        {!parsedEval && sm.overallEvaluation && (
          <div className="bg-white/5 rounded-lg p-4 mt-2">
            <h4 className="font-semibold mb-2 text-[#17bfca]">Cross-Platform Analysis</h4>
            <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
              {sm.overallEvaluation}
            </p>
          </div>
        )}
      </div>
    ),
    score: sm.overallScore,
    rightMeta: (
      <div>
        <div className="text-2xl font-semibold">{sm.overallScore}</div>
        <div className="text-sm opacity-90">{scoreLabel(sm.overallScore)}</div>
      </div>
    ),
  });

  // ── Card 2: Cross-Platform Scores + Assessment ──
  const hasCrossPlatform = crossPlatformScores && Object.keys(crossPlatformScores).length > 0;
  const hasAssessment = overallAssessment && (
    overallAssessment.key_strengths?.length > 0 ||
    overallAssessment.critical_gaps?.length > 0 ||
    overallAssessment.missing_opportunities?.length > 0
  );

  if (hasCrossPlatform || hasAssessment) {
    const crossPlatformTabs = hasCrossPlatform
      ? Object.entries(crossPlatformScores).map(([label, data]: [string, any]) => ({
          title: label,
          rightMeta: (
            <div className="text-right">
              <div className="text-sm sm:text-base font-semibold leading-none" style={scoreColorStyle(data.score)}>
                {data.score}
              </div>
              <div className="text-[10px] sm:text-xs text-white/50 leading-none mt-0.5">
                {scoreLabel(data.score)}
              </div>
            </div>
          ),
          content: (
            <p className="leading-relaxed">{data.assessment}</p>
          ),
        }))
      : [];

    items.push({
      id: "cross-platform-scores",
      title: "Cross-Platform Scores",
      content: (
        <div className="space-y-4 flex-1 flex flex-col">
          {crossPlatformTabs.length > 0 && (
            <VerticalTabs items={crossPlatformTabs} className="min-h-[120px]" />
          )}

          {overallAssessment?.key_strengths?.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1 text-[#64b5a0] text-sm">Key Strengths</h4>
              <ul className="list-disc pl-5 space-y-1">
                {overallAssessment.key_strengths.map((item: string, i: number) => (
                  <li key={i} className="text-sm text-white/80">{item}</li>
                ))}
              </ul>
            </div>
          )}
          {overallAssessment?.critical_gaps?.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1 text-[#e8a87c] text-sm">Critical Gaps</h4>
              <ul className="list-disc pl-5 space-y-1">
                {overallAssessment.critical_gaps.map((item: string, i: number) => (
                  <li key={i} className="text-sm text-white/80">{item}</li>
                ))}
              </ul>
            </div>
          )}
          {overallAssessment?.missing_opportunities?.length > 0 && (
            <div>
              <h4 className="font-semibold mb-1 text-[#17bfca] text-sm">Missed Opportunities</h4>
              <ul className="list-disc pl-5 space-y-1">
                {overallAssessment.missing_opportunities.map((item: string, i: number) => (
                  <li key={i} className="text-sm text-white/80">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ),
      score: sm.overallScore,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{sm.overallScore}</div>
          <div className="text-sm opacity-90">{scoreLabel(sm.overallScore)}</div>
        </div>
      ),
    });
  }

  // ── Platform cards with tabbed scoring metrics ──
  for (const platform of sm.platformsAnalyzed) {
    const p = sm.platformScores[platform];
    if (!p) continue;

    const metricTabs = buildCategoryTabs(p);

    items.push({
      id: `platform-${platform.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      title: platform,
      subtitle: p.socialMediaUrl ? (
        <a
          href={p.socialMediaUrl.startsWith("http") ? p.socialMediaUrl : `https://${p.socialMediaUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: "#17bfca" }}
        >
          {p.socialMediaUrl.replace(/^https?:\/\/(www\.)?/, "")}
        </a>
      ) : undefined,
      content: (
        <div className="space-y-3 flex-1 flex flex-col">
          <VerticalTabs items={metricTabs} className="min-h-[120px]" />
          {renderPlatformExtras(p)}
        </div>
      ),
      score: p.platformAverage,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{p.platformAverage}</div>
          <div className="text-sm opacity-90">{scoreLabel(p.platformAverage)}</div>
        </div>
      ),
    });
  }

  // ── 90-Day Action Plan (last card) ──
  if (ninetyDayActionPlan?.length > 0) {
    const actionPlanTabs = ninetyDayActionPlan.map((initiative: any) => ({
      title: initiative.initiativeTitle ?? initiative.initiative_title ?? "Initiative",
      content: (
        <ul className="list-disc pl-4 space-y-1">
          {initiative.actions.map((action: string, j: number) => (
            <li key={j}>{action}</li>
          ))}
        </ul>
      ),
    }));

    items.push({
      id: "social-action-plan",
      title: "90-Day Action Plan",
      content: <VerticalTabs items={actionPlanTabs} />,
      wide: true,
      tall: true,
    });
  }

  return <Presentation items={items} />;
}
