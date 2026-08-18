'use client';
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AuditNav } from "@/components/AuditNav";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { AuditProvider, useAudit } from "@/components/AuditProvider";
import { useState, useEffect } from "react";
import { OverlayDialog } from "@/components/OverlayDialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { generateAuditPDF } from "@/components/AuditPDFTemplate";
import { HEALTH_BAR_SEGMENTS, SCORE_LEGEND } from "@/lib/scoring";

function AuditContent({ children }: { children: ReactNode }) {
  const base = "/audit";
  const [openHelp, setOpenHelp] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState<"v1" | "v2" | null>(null);
  const { audit, loading, error, pendingSections } = useAudit();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id");

  /**
   * Calls the snapshot agent API, receives a PDF blob, and triggers a browser
   * download. Disabled while agents are still running or a request is in flight.
   */
  async function handleSnapshot(templateVersion: "v1" | "v2" = "v1") {
    if (!auditId || snapshotLoading) return;
    setSnapshotLoading(templateVersion);
    try {
      const res = await fetch("/api/snapshot_agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_input_id: auditId, templateVersion }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Snapshot failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const suffix = templateVersion === "v2" ? "-snapshot-v2" : "-snapshot";
      link.download = `${audit.companyName ?? "enid"}${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[snapshot] download failed:", err);
      alert(err instanceof Error ? err.message : "Snapshot generation failed. Please try again.");
    } finally {
      setSnapshotLoading(null);
    }
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (!loading && error) {
      router.replace("/dashboard");
    }
  }, [loading, error, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-accent" />
          <p className="mt-4 text-sm text-zinc-500">Loading audit results…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return null;
  }
  
  return (
    <>
      {/* Header with white background */}
      <header className="bg-white border-b border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Logo height={56} />
            <Link
              href="/dashboard"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main content with zinc background */}
      <div className="bg-zinc-50 min-h-screen">
        <div className="mx-auto w-full max-w-6xl px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <AuditNav base={base} />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setOpenHelp(true)}
                className="rounded-md border border-[#d4a249] bg-white px-3 py-1.5 text-sm font-medium text-[#d4a249] hover:border-[#d4a249] hover:bg-[#d4a249]/10"
              >
                How to Read Your Scores
              </button>
              <button
                type="button"
                onClick={() => generateAuditPDF(audit)}
                className="rounded-md border border-[#8b5a96] bg-[#8b5a96] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#7a4d85]"
              >
                Download as PDF
              </button>
              <button
                type="button"
                onClick={() => handleSnapshot("v1")}
                disabled={!!snapshotLoading || pendingSections.length > 0 || loading}
                className="flex items-center justify-center gap-2 rounded-md border border-[#25394b] bg-[#25394b] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1c2e3d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {snapshotLoading === "v1" ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating…
                  </>
                ) : (
                  "Download Snapshot"
                )}
              </button>
              {/* Admin-only testing affordance for the new client-supplied
                  template — remove once v2 is approved and promoted to default. */}
              <button
                type="button"
                onClick={() => handleSnapshot("v2")}
                disabled={!!snapshotLoading || pendingSections.length > 0 || loading}
                className="flex items-center justify-center gap-2 rounded-md border border-[#25394b] bg-white px-3 py-1.5 text-sm font-medium text-[#25394b] hover:bg-[#25394b]/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {snapshotLoading === "v2" ? (
                  <>
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#25394b] border-t-transparent" />
                    Generating…
                  </>
                ) : (
                  "Preview New Template"
                )}
              </button>
            </div>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
        <OverlayDialog
          open={openHelp}
          onClose={() => setOpenHelp(false)}
          size="xl"
        >
          {(() => {
            const palette = {
              red: "#c96858",
              green: "#57a587",
              white: "#f6f6f6",
              navy: "#25394b",
              yellow: "#d5a349",
              grey: "#7c8287",
              blue: "#17bfca",
            };
            return (
              <>
                <div className="mb-4">
                  <div
                    className="h-1.5 w-24 rounded-full"
                    style={{ backgroundColor: palette.blue }}
                  />
                  <h2
                    className="mt-4 text-3xl font-semibold"
                    style={{ color: palette.navy }}
                  >
                    How to Read Your Scores
                  </h2>
                </div>
                <p className="text-base" style={{ color: palette.grey }}>
                  Understanding your brand health metrics
                </p>
              </>
            );
          })()}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {SCORE_LEGEND.map((card) => (
              <div
                key={card.id}
                className="rounded-2xl p-5"
                style={{ border: `2px solid ${card.color}` }}
              >
                <p className="text-lg font-semibold" style={{ color: "#25394b" }}>
                  {card.title}
                </p>
                <div className="mt-2" aria-hidden="true" style={{ color: card.color }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className="text-xl"
                      style={{ opacity: i <= card.filledStars ? 1 : 0.2 }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm" style={{ color: "#7c8287" }}>
                  Stars: {card.starsRange}
                </p>
                <p className="mt-3 text-sm" style={{ color: "#7c8287" }}>
                  {card.description}
                </p>
              </div>
            ))}
          </div>
          {/* Brand Health Scale */}
          <div
            className="mt-6 rounded-2xl border p-5"
            style={{ borderColor: "#d5a349" }}
          >
            <p className="text-center text-lg font-semibold" style={{ color: "#25394b" }}>
              Brand Health Scale
            </p>
            <div
              className="mt-4 h-3 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "#f6f6f6" }}
            >
              <div className="flex h-full w-full">
                {HEALTH_BAR_SEGMENTS.map((seg, idx) => (
                  <div
                    key={idx}
                    className="h-full"
                    style={{ flex: 1, backgroundColor: seg.color }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 flex text-sm">
              {HEALTH_BAR_SEGMENTS.map((seg, idx) => (
                <div key={idx} style={{ width: `${100 / HEALTH_BAR_SEGMENTS.length}%`, color: "#7c8287" }} className="text-left">
                  <p>{seg.scoreRange}</p>
                  <p>{seg.label}</p>
                </div>
              ))}
            </div>
          </div>
        </OverlayDialog>
    </>
  );
}

export default function AuditLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-accent" />
      </div>
    }>
      <AuditProvider>
        <AuditContent>{children}</AuditContent>
      </AuditProvider>
    </Suspense>
  );
}
