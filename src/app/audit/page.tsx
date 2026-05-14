"use client";
import { Card } from "@/components/Card";
import { FadeIn, SlideUpInView } from "@/components/anim";
import Link from "next/link";
import { useAudit } from "@/components/AuditProvider";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

export default function AuditOverviewNoId() {
  const { audit: data, pendingSections } = useAudit();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const suffix = qs ? `?${qs}` : "";
  const base = "/audit";
  const hasSocialError = !!data.socialMediaError;
  const hasCompetitorError = !!data.competitorError;
  const hasSocialData = !!data.socialMediaReport;
  const hasCompetitorData = !!data.competitorReport;
  const socialPending = pendingSections.includes("social");
  const competitorPending = pendingSections.includes("competitors");
  const socialUnavailable = !socialPending && !hasSocialData && !hasSocialError;
  const competitorUnavailable = !competitorPending && !hasCompetitorData && !hasCompetitorError;
  return (
    <div>
      <FadeIn>
        {/* Welcome Header */}
        <div className="mb-5 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 mb-2">
            Welcome, {data.companyName}
          </h1>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-lg sm:text-xl text-zinc-700">
              Your Brand, Website, Social Media & Competitor Audit, guided by
            </span>
            <Image
              src="/Enid_Wordmark_Full_Color.png"
              alt="Enid"
              height={24}
              width={96}
              priority
            />
          </div>
          <p className="text-sm text-zinc-500">
            Think of this as a snapshot of how your brand shows up right now.
          </p>
        </div>

        {/* Overview Cards */}
        <div className="mb-6 grid gap-6 grid-cols-1 sm:grid-cols-2">
          <SlideUpInView>
            <Card title="Brand Overview" className="h-full flex flex-col">
              <p className="text-zinc-700 text-sm mb-2">
                A high-level summary of how the brand presents itself across:
              </p>
              <ul className="text-zinc-700 text-sm mb-2 ml-4 list-disc space-y-0.5">
                <li>Identity</li>
                <li>Messaging</li>
                <li>Market positioning</li>
                <li>Customer focus</li>
              </ul>
              <p className="text-zinc-700 text-sm mb-3">
                This section captures what the brand claims to stand for, who it serves, and the core value it aims to deliver.
              </p>
              <div className="mt-auto">
                <Link
                  href={`${base}/brand${suffix}`}
                  className="inline-block w-full text-center bg-[#25394b] text-white font-medium py-2 px-3 rounded-lg hover:bg-[#1e2f3d] transition-colors text-sm"
                >
                  Let's Meet This Brand →
                </Link>
              </div>
            </Card>
          </SlideUpInView>
          <SlideUpInView delay={0.05}>
            <Card title="Website Overview" className="h-full flex flex-col">
              <p className="text-zinc-700 text-sm mb-2">
                An evaluation of how the brand is expressed through the website covering:
              </p>
              <ul className="text-zinc-700 text-sm mb-2 ml-4 list-disc space-y-0.5">
                <li>Clarity</li>
                <li>Structure</li>
                <li>Messaging</li>
                <li>User Experience</li>
              </ul>
              <p className="text-zinc-700 text-sm mb-3">
                This section highlights the site's role in communicating value and guiding visitors toward action.
              </p>
              <div className="mt-auto">
                <Link
                  href={`${base}/website${suffix}`}
                  className="inline-block w-full text-center bg-[#25394b] text-white font-medium py-2 px-3 rounded-lg hover:bg-[#1e2f3d] transition-colors text-sm"
                >
                  Let's Explore the Website →
                </Link>
              </div>
            </Card>
          </SlideUpInView>
          <SlideUpInView delay={0.1}>
            <Card title="Social Media Overview" className="h-full flex flex-col">
              <div className="flex-1 flex flex-col">
              {socialPending ? (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                  <span className="mb-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-[#25394b]" />
                  <p className="text-sm font-medium text-zinc-600">
                    Social media analysis is still running&hellip;
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Results will appear here automatically.
                  </p>
                </div>
              ) : socialUnavailable ? (
                <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm font-medium text-zinc-600">
                    Social Media Analysis Not Run
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Social media analysis did not complete for this audit. Run a new audit to get social media results.
                  </p>
                </div>
              ) : hasSocialError ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-medium text-amber-700">Error During Processing</span>
                  </div>
                  <p className="text-zinc-600 text-sm mb-3">
                    {data.socialMediaError}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-zinc-700 text-sm mb-2">
                    An evaluation of the brand&apos;s social media presence across:
                  </p>
                  <ul className="text-zinc-700 text-sm mb-2 ml-4 list-disc space-y-0.5">
                    <li>Platform-specific performance</li>
                    <li>Content quality & consistency</li>
                    <li>Brand alignment & voice</li>
                    <li>Cross-platform synergy</li>
                  </ul>
                  <p className="text-zinc-700 text-sm mb-3">
                    This section evaluates how the brand shows up on social media and identifies strategic opportunities for growth.
                  </p>
                </>
              )}
              </div>
              <div className="mt-auto">
                {socialPending || socialUnavailable ? (
                  <span className="inline-block w-full text-center bg-zinc-200 text-zinc-400 font-medium py-2 px-3 rounded-lg cursor-not-allowed text-sm">
                    {socialPending ? "Waiting for results\u2026" : "No data available"}
                  </span>
                ) : (
                  <Link
                    href={`${base}/social${suffix}`}
                    className="inline-block w-full text-center bg-[#25394b] text-white font-medium py-2 px-3 rounded-lg hover:bg-[#1e2f3d] transition-colors text-sm"
                  >
                    {hasSocialError ? "View Details →" : "Let's Check the Socials →"}
                  </Link>
                )}
              </div>
            </Card>
          </SlideUpInView>
          <SlideUpInView delay={0.15}>
            <Card title="Competitor Research" className="h-full flex flex-col">
              <div className="flex-1 flex flex-col">
              {competitorPending ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <span className="mb-3 inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-[#25394b]" />
                  <p className="text-sm font-medium text-zinc-600">
                    Competitor analysis is still running&hellip;
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Results will appear here automatically.
                  </p>
                </div>
              ) : competitorUnavailable ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm font-medium text-zinc-600">
                    Competitor Data Not Available
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Competitor data was not returned for this audit. This may happen if no competitor URLs were provided.
                  </p>
                </div>
              ) : hasCompetitorError ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-sm font-medium text-amber-700">Error During Processing</span>
                  </div>
                  <p className="text-zinc-600 text-sm mb-3">
                    {data.competitorError}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-zinc-700 text-sm mb-2">
                    A competitive intelligence report analyzing your market landscape across:
                  </p>
                  <ul className="text-zinc-700 text-sm mb-2 ml-4 list-disc space-y-0.5">
                    <li>Key competitor profiles</li>
                    <li>Strengths & weaknesses</li>
                    <li>Market positioning & scope</li>
                    <li>Leadership & social presence</li>
                  </ul>
                  <p className="text-zinc-700 text-sm mb-3">
                    This section identifies who you&apos;re competing with and where your opportunities lie.
                  </p>
                </>
              )}
              </div>
              <div className="mt-auto">
                {competitorPending || competitorUnavailable ? (
                  <span className="inline-block w-full text-center bg-zinc-200 text-zinc-400 font-medium py-2 px-3 rounded-lg cursor-not-allowed text-sm">
                    {competitorPending ? "Waiting for results\u2026" : "No data available"}
                  </span>
                ) : (
                  <Link
                    href={`${base}/competitors${suffix}`}
                    className="inline-block w-full text-center bg-[#25394b] text-white font-medium py-2 px-3 rounded-lg hover:bg-[#1e2f3d] transition-colors text-sm"
                  >
                    {hasCompetitorError ? "View Details →" : "Let's See the Competition →"}
                  </Link>
                )}
              </div>
            </Card>
          </SlideUpInView>
        </div>
      </FadeIn>
    </div>
  );
}