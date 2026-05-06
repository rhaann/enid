'use client';
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AuditNav } from "@/components/AuditNav";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { AuditProvider, useAudit } from "@/components/AuditProvider";
import { useState, useEffect } from "react";
import { OverlayDialog } from "@/components/OverlayDialog";
import { usePathname, useRouter } from "next/navigation";
import { generateAuditPDF } from "@/components/AuditPDFTemplate";
import { HEALTH_BAR_SEGMENTS, SCORE_LEGEND } from "@/lib/scoring";

function AuditContent({ children }: { children: ReactNode }) {
  const base = "/audit";
  const [openHelp, setOpenHelp] = useState(false);
  const { audit, loading, error } = useAudit();
  const pathname = usePathname();
  const router = useRouter();

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
                    style={{ width: `${seg.weight * 100}%`, backgroundColor: seg.color }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center text-sm">
              {HEALTH_BAR_SEGMENTS.map((seg, idx) => (
                <div key={idx} style={{ color: "#7c8287" }}>
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
