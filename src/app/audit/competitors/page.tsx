"use client";
import { useAudit } from "@/components/AuditProvider";
import { Presentation, type PresentationItem } from "@/components/Presentation";
import { VerticalTabs } from "@/components/VerticalTabs";
import type { CompetitorProfile } from "@/lib/auditModel";

export default function CompetitorResearchPage() {
  const { audit } = useAudit();
  const cr = audit.competitorReport;

  if (!cr || cr.competitors.length === 0) {
    const errorMsg = audit.competitorError;
    // Loading: competitor agent is actively running, OR the evaluator hasn't finished
    // yet (competitor hasn't been dispatched). Once auditStatus is "done" and the
    // competitor agent is no longer in activeAgents, it has finished (or never ran).
    const isLoading =
      (audit.activeAgents ?? []).includes("competitor-agent") ||
      audit.auditStatus === "In Progress";

    // Loading — agent is actively running
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-24">
          <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm max-w-md w-full">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-[#17bfca]" />
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Analyzing Competitors</h2>
            <p className="text-zinc-500 text-sm mb-4">
              Researching your competitive landscape. This usually takes 1–3 minutes.
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
            <h2 className="text-xl font-semibold text-zinc-900 mb-2">Competitor Research Failed</h2>
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
          <h2 className="text-xl font-semibold text-zinc-900 mb-2">No Competitors Found</h2>
          <p className="text-zinc-600 text-sm">
            The competitor research agent ran but could not identify any competitors for this company. Try adding competitor URLs manually and running the audit again.
          </p>
        </div>
      </div>
    );
  }

  const typeColor = (type: string) => {
    switch (type) {
      case "local":
        return "bg-[#17bfca]/20 text-[#17bfca]";
      case "national":
        return "bg-[#e8a87c]/20 text-[#e8a87c]";
      case "global":
        return "bg-[#64b5a0]/20 text-[#64b5a0]";
      default:
        return "bg-white/10 text-white/70";
    }
  };

  const count = cr.competitors.length;
  const landscapeSummary = cr.landscapeSummary
    || (count >= 4
      ? `We identified ${count} competitors operating in your space.`
      : count > 0
        ? `We found ${count} competitor${count > 1 ? "s" : ""} in your space. Finding all 4 was difficult — the market may be niche or data was limited.`
        : `We had trouble identifying competitors for this company. Consider providing competitor URLs manually.`);

  const items: PresentationItem[] = [];

  // -- Card 1: Competitor Landscape Overview --
  items.push({
    id: "competitor-overview",
    title: "Competitor Landscape",
    content: (
      <div className="space-y-4">
        <p className="text-sm text-white/80 leading-relaxed">
          {landscapeSummary}
        </p>

        <div className="flex gap-3 text-xs">
          {cr.competitors.filter((c) => c.competitorType === "local").length > 0 && (
            <span className="rounded-full bg-[#17bfca]/15 text-[#17bfca] px-2.5 py-0.5 font-medium">
              {cr.competitors.filter((c) => c.competitorType === "local").length} Local
            </span>
          )}
          {cr.competitors.filter((c) => c.competitorType === "national").length > 0 && (
            <span className="rounded-full bg-[#e8a87c]/15 text-[#e8a87c] px-2.5 py-0.5 font-medium">
              {cr.competitors.filter((c) => c.competitorType === "national").length} National
            </span>
          )}
          {cr.competitors.filter((c) => c.competitorType === "global").length > 0 && (
            <span className="rounded-full bg-[#64b5a0]/15 text-[#64b5a0] px-2.5 py-0.5 font-medium">
              {cr.competitors.filter((c) => c.competitorType === "global").length} Global
            </span>
          )}
        </div>

        <div className="space-y-2">
          {cr.competitors.map((c) => (
            <div
              key={c.companyUrl}
              className="rounded-lg bg-white/10 px-4 py-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white">
                  {c.companyName}
                </span>
                <span
                  className={`ml-2 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${typeColor(c.competitorType)}`}
                >
                  {c.competitorType}
                </span>
              </div>
              {c.overview && (
                <p className="text-xs text-white/60 leading-snug">
                  {c.overview}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
  });

  // -- Individual competitor cards --
  for (const comp of cr.competitors) {
    const advantages = comp.advantage
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const disadvantages = comp.disadvantage
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    const detailTabs = buildDetailTabs(comp, advantages, disadvantages);

    items.push({
      id: `competitor-${comp.companyName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      title: comp.companyName,
      content: (
        <VerticalTabs items={detailTabs} />
      ),
      rightMeta: (
        <div className="text-right">
          <a
            href={comp.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#17bfca] hover:underline"
          >
            Visit Site
          </a>
        </div>
      ),
    });
  }

  return <Presentation items={items} />;
}

function formatDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

const SOCIAL_PLATFORMS: [RegExp, string][] = [
  [/linkedin\.com/i, "LinkedIn"],
  [/twitter\.com/i, "Twitter"],
  [/x\.com/i, "X"],
  [/facebook\.com|fb\.com/i, "Facebook"],
  [/instagram\.com/i, "Instagram"],
  [/youtube\.com|youtu\.be/i, "YouTube"],
  [/tiktok\.com/i, "TikTok"],
  [/pinterest\.com/i, "Pinterest"],
  [/github\.com/i, "GitHub"],
  [/threads\.net/i, "Threads"],
  [/reddit\.com/i, "Reddit"],
  [/medium\.com/i, "Medium"],
  [/glassdoor\.com/i, "Glassdoor"],
  [/crunchbase\.com/i, "Crunchbase"],
];

function getSocialLabel(link: string): string {
  for (const [pattern, name] of SOCIAL_PLATFORMS) {
    if (pattern.test(link)) return name;
  }
  try {
    const host = new URL(link.startsWith("http") ? link : `https://${link}`).hostname;
    const parts = host.replace(/^www\./, "").split(".");
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return "Social";
  }
}

function buildDetailTabs(
  comp: CompetitorProfile,
  advantages: string[],
  disadvantages: string[]
) {
  const tabs: { title: string; content: React.ReactNode }[] = [];

  tabs.push({
    title: "Company Info",
    content: (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-white/50">Website</span>
            <a
              href={comp.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#17bfca] hover:underline"
            >
              {formatDomain(comp.companyUrl)}
            </a>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Size</span>
            <span>{comp.size}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Location</span>
            <span>{comp.location}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Established</span>
            <span>{comp.establishedDate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Scope</span>
            <span className="capitalize">{comp.competitorType}</span>
          </div>
        </div>

        {comp.leadership.length > 0 && (
          <div>
            <h5 className="text-white/50 text-xs uppercase tracking-wide mb-1">Leadership</h5>
            <div className="flex flex-wrap gap-1.5">
              {comp.leadership.map((l, i) => (
                <span
                  key={i}
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/80"
                >
                  {l.name} <span className="text-white/50">({l.title})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {comp.socialLinks.length > 0 && (
          <div>
            <h5 className="text-white/50 text-xs uppercase tracking-wide mb-1">Social Profiles</h5>
            <div className="flex flex-wrap gap-1.5">
              {comp.socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-[#17bfca] hover:bg-white/20 transition-colors"
                >
                  {getSocialLabel(link)}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    ),
  });

  if (advantages.length > 0) {
    tabs.push({
      title: "Advantages",
      content: (
        <ul className="list-disc pl-4 space-y-1">
          {advantages.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ),
    });
  }

  if (disadvantages.length > 0) {
    tabs.push({
      title: "Disadvantages",
      content: (
        <ul className="list-disc pl-4 space-y-1">
          {disadvantages.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ),
    });
  }

  return tabs;
}
