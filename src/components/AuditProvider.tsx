"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AuditReport } from "@/lib/auditModel";
import { fakeAudit } from "@/lib/auditModel";
import { fetchAuditById } from "@/lib/auditClient";

const POLL_INTERVAL = 10_000;
const MAX_POLLS = 90; // 15 minutes — covers evaluator (5min) + competitor + social (5min each)

// Audit is fully complete only when both competitor and social have results or errors.
// "done" on the audit input just means the evaluator finished — not the full pipeline.
// competitorSettled / socialSettled mean the pipeline settled with no data (old audits
// or agents that ran but produced no rows) — treated as complete for polling purposes.
function isComplete(a: AuditReport): boolean {
  if (a.auditStatus?.toLowerCase() === "failed") return true;
  const hasSocial = !!a.socialMediaReport || !!a.socialMediaError || !!a.socialSettled;
  const hasCompetitor = !!a.competitorReport || !!a.competitorError || !!a.competitorSettled;
  return hasSocial && hasCompetitor;
}

type AuditContextValue = {
  audit: AuditReport;
  loading: boolean;
  error: string | null;
  pendingSections: string[];
};

const AuditContext = createContext<AuditContextValue | undefined>(undefined);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const auditId = searchParams.get("id");

  const [audit, setAudit] = useState<AuditReport>(fakeAudit);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSections, setPendingSections] = useState<string[]>([]);
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While polling is active, any section that has no data and no error is
  // considered pending — we don't know if it's still running or hasn't started
  // yet. The caller is responsible for only calling this while polling is live;
  // when polling ends we clear pendingSections directly so the UI shows the
  // true final state (data, error, or genuinely unavailable).
  function computePending(a: AuditReport): string[] {
    const pending: string[] = [];
    if (!a.socialMediaReport && !a.socialMediaError && !a.socialSettled) pending.push("social");
    if (!a.competitorReport && !a.competitorError && !a.competitorSettled) pending.push("competitors");
    return pending;
  }

  useEffect(() => {
    if (!auditId) {
      setLoading(false);
      setError("No audit ID provided.");
      return;
    }

    let cancelled = false;
    pollCount.current = 0;
    setLoading(true);
    setError(null);

    function scheduleRefetch() {
      if (cancelled) return;
      // Polling limit reached — whatever is missing at this point is genuinely
      // unavailable. Clear pending so the UI stops spinning and shows the real state.
      if (pollCount.current >= MAX_POLLS) {
        setPendingSections([]);
        return;
      }
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        pollCount.current += 1;
        try {
          const updated = await fetchAuditById(auditId!);
          if (cancelled) return;
          setAudit(updated);
          if (isComplete(updated)) {
            // Pipeline finished — set final state and stop polling.
            setPendingSections([]);
          } else {
            setPendingSections(computePending(updated));
            scheduleRefetch();
          }
        } catch {
          if (!cancelled) scheduleRefetch();
        }
      }, POLL_INTERVAL);
    }

    fetchAuditById(auditId)
      .then((mapped) => {
        if (!cancelled) {
          setAudit(mapped);
          setLoading(false);
          if (isComplete(mapped)) {
            setPendingSections([]);
          } else {
            setPendingSections(computePending(mapped));
            scheduleRefetch();
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load audit.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [auditId]);

  return (
    <AuditContext.Provider value={{ audit, loading, error, pendingSections }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit(): AuditContextValue {
  const ctx = useContext(AuditContext);
  if (!ctx) {
    throw new Error("useAudit must be used within an AuditProvider");
  }
  return ctx;
}
