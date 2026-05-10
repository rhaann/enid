"use client";
import { useAudit } from "@/components/AuditProvider";
import { Presentation, type PresentationItem } from "@/components/Presentation";
import { getScoreLabel } from "@/lib/scoring";

export default function WebsiteReportNoId() {
  const { audit } = useAudit();
  const web = audit.websiteReport;
  const s = audit.websiteScores;

  const scoreLabel = (score?: number) => getScoreLabel(score);

  // Helper to render website card content (Assessment + What's Working + What Needs Attention)
  const renderWebsiteContent = (
    assessment?: string,
    whatsWorking?: string[],
    whatsNeedsAttention?: string[]
  ) => (
    <div className="space-y-4">
      <p className="whitespace-pre-line">{assessment ?? ""}</p>
      {(whatsWorking ?? []).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-[#64b5a0]">What's Working</h4>
          <ul className="list-disc pl-5 space-y-1">
            {(whatsWorking ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {(whatsNeedsAttention ?? []).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-[#e8a87c]">What Needs Attention</h4>
          <ul className="list-disc pl-5 space-y-1">
            {(whatsNeedsAttention ?? []).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const items: PresentationItem[] = [
    {
      id: "overview",
      title: "Website Overview",
      content: (
        <div className="space-y-4">
          <p className="whitespace-pre-line">{web.websiteOverview?.assessment ?? ""}</p>
          {web.websiteOverview?.keyTakeaway && (
            <div className="bg-white/5 rounded-lg p-3">
              <span className="font-semibold text-[#64b5a0]">Key Takeaway: </span>
              {web.websiteOverview.keyTakeaway}
            </div>
          )}
        </div>
      ),
      score: s?.websiteOverview,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.websiteOverview ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.websiteOverview)}</div>
        </div>
      ),
    },
    {
      id: "brand-expression",
      title: "Brand Expression & Visual",
      content: renderWebsiteContent(
        web.brandExpression?.assessment,
        web.brandExpression?.whatsWorking,
        web.brandExpression?.whatsNeedsAttention
      ),
      score: s?.brandExpression,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.brandExpression ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.brandExpression)}</div>
        </div>
      ),
    },
    {
      id: "messaging",
      title: "Messaging & Clarity",
      content: renderWebsiteContent(
        web.messagingAndClarity?.assessment,
        web.messagingAndClarity?.whatsWorking,
        web.messagingAndClarity?.whatsNeedsAttention
      ),
      score: s?.messagingAndClarity,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.messagingAndClarity ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.messagingAndClarity)}</div>
        </div>
      ),
    },
    {
      id: "ux-navigation",
      title: "UX & Navigation",
      content: renderWebsiteContent(
        web.uxAndNavigation?.assessment,
        web.uxAndNavigation?.whatsWorking,
        web.uxAndNavigation?.whatsNeedsAttention
      ),
      score: s?.uxAndNavigation,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.uxAndNavigation ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.uxAndNavigation)}</div>
        </div>
      ),
    },
    {
      id: "accessibility",
      title: "Readability & Inclusivity",
      content: renderWebsiteContent(
        web.accessibility?.assessment,
        web.accessibility?.whatsWorking,
        web.accessibility?.whatsNeedsAttention
      ),
      score: s?.accessibility,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.accessibility ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.accessibility)}</div>
        </div>
      ),
    },
    {
      id: "ctas-trust",
      title: "CTAs, Trust & Conversion",
      content: renderWebsiteContent(
        web.ctasTrustConversion?.assessment,
        web.ctasTrustConversion?.whatsWorking,
        web.ctasTrustConversion?.whatsNeedsAttention
      ),
      score: s?.ctasTrustConversion,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.ctasTrustConversion ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.ctasTrustConversion)}</div>
        </div>
      ),
    },
    {
      id: "social-consistency",
      title: "Social Consistency",
      content: renderWebsiteContent(
        web.socialConsistency?.assessment,
        web.socialConsistency?.whatsWorking,
        web.socialConsistency?.whatsNeedsAttention
      ),
      score: s?.socialConsistency,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.socialConsistency ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.socialConsistency)}</div>
        </div>
      ),
    },
    {
      id: "risk-confidence",
      title: "Risk & Confidence",
      content: renderWebsiteContent(
        web.riskAndConfidenceFraming?.assessment,
        web.riskAndConfidenceFraming?.whatsWorking,
        web.riskAndConfidenceFraming?.whatsNeedsAttention
      ),
      score: s?.riskAndConfidenceFraming,
      rightMeta: (
        <div>
          <div className="text-2xl font-semibold">{s?.riskAndConfidenceFraming ?? 0}</div>
          <div className="text-sm opacity-90">{scoreLabel(s?.riskAndConfidenceFraming)}</div>
        </div>
      ),
    },
    {
      id: "whats-working",
      title: "What's Working Overall",
      content: (
        <ul className="list-disc pl-5 space-y-2">
          {(web.finalSynthesis?.whatsWorkingOverall ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ),
    },
    {
      id: "needs-attention",
      title: "What Needs Attention Overall",
      content: (
        <ul className="list-disc pl-5 space-y-2">
          {(web.finalSynthesis?.whatsNeedsAttentionOverall ?? []).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ),
    },
  ];
  return <Presentation items={items} />;
}
