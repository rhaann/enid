"use client";
import { useAudit } from "@/components/AuditProvider";
import { Presentation, type PresentationItem } from "@/components/Presentation";
import { VerticalTabs } from "@/components/VerticalTabs";
import { getScoreLabel } from "@/lib/scoring";

export default function BrandReportNoId() {
  const { audit } = useAudit();
  const b = audit.brandReport;
  const s = audit.brandScores;

  const scoreLabel = (score?: number) => getScoreLabel(score);

  // Helper to render brand card content (Assessment + Opportunity)
  const renderBrandContent = (assessment?: string, opportunity?: string[]) => (
    <div className="space-y-4">
      <p className="whitespace-pre-line">{assessment ?? ""}</p>
      {(opportunity ?? []).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-[#64b5a0]">Opportunity</h4>
          <ul className="list-disc pl-5 space-y-1">
            {(opportunity ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  // Generate 90-Day Brand Game Plan tabs from backend data
  const gamePlanTabs = (b.ninetyDayPlanSummary ?? []).map((item) => {
    const title = Object.keys(item)[0] ?? "";
    const actions = item[title] ?? [];
    return {
      title,
      content: actions.length > 0 ? (
        <ul className="list-disc pl-4 space-y-1">
          {actions.map((action: string, idx: number) => (
            <li key={idx}>{action}</li>
          ))}
        </ul>
      ) : null,
    };
  });

  const items: PresentationItem[] = [
    {
      id: "brand-overview",
      title: "Brand Overview",
      content: <p className="whitespace-pre-line">{b.brandOverview?.assessment ?? ""}</p>,
      score: s?.brandOverview,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.brandOverview ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.brandOverview)}</div>
        </div>
      ),
    },
    {
      id: "who-you-are",
      title: "Who You Are",
      content: renderBrandContent(b.whoYouAre?.assessment, b.whoYouAre?.opportunity),
      score: s?.whoYouAre,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.whoYouAre ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.whoYouAre)}</div>
        </div>
      ),
    },
    {
      id: "how-you-look",
      title: "How You Look",
      content: renderBrandContent(b.howYouLook?.assessment, b.howYouLook?.opportunity),
      score: s?.howYouLook,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.howYouLook ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.howYouLook)}</div>
        </div>
      ),
    },
    {
      id: "how-you-sound",
      title: "How You Sound",
      content: renderBrandContent(b.howYouSound?.assessment, b.howYouSound?.opportunity),
      score: s?.howYouSound,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.howYouSound ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.howYouSound)}</div>
        </div>
      ),
    },
    {
      id: "who-you-serve",
      title: "Who You Serve",
      content: renderBrandContent(b.whoYouServe?.assessment, b.whoYouServe?.opportunity),
      score: s?.whoYouServe,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.whoYouServe ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.whoYouServe)}</div>
        </div>
      ),
    },
    {
      id: "positioning",
      title: "Positioning & Market Fit",
      content: renderBrandContent(b.positionAndMarketFit?.assessment, b.positionAndMarketFit?.opportunity),
      score: s?.positionAndMarketFit,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.positionAndMarketFit ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.positionAndMarketFit)}</div>
        </div>
      ),
    },
    {
      id: "gameplan",
      title: "90‑Day Brand Game Plan",
      content: <VerticalTabs items={gamePlanTabs} />,
      wide: true,
    },
  ];
  return <Presentation items={items} />;
}
