"use client";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AuditReport } from "@/lib/auditModel";
import { fakeAudit } from "@/lib/auditModel";
import { fetchAuditById } from "@/lib/auditClient";

const POLL_INTERVAL = 10_000;
const MAX_POLLS = 12; // ~2 minutes max

function isTerminal(a: AuditReport): boolean {
  const s = (a.auditStatus ?? "").toLowerCase();
  return s === "done" || s === "failed";
}

function isComplete(a: AuditReport): boolean {
  if (isTerminal(a)) return true;
  const hasSocial = !!a.socialMediaReport || !!a.socialMediaError;
  const hasCompetitor = !!a.competitorReport || !!a.competitorError;
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

  function computePending(a: AuditReport): string[] {
    if (isTerminal(a)) return [];
    const pending: string[] = [];
    if (!a.socialMediaReport && !a.socialMediaError) pending.push("social");
    if (!a.competitorReport && !a.competitorError) pending.push("competitors");
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
      if (cancelled || pollCount.current >= MAX_POLLS) return;
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        pollCount.current += 1;
        try {
          const updated = await fetchAuditById(auditId!);
          if (cancelled) return;
          setAudit(updated);
          const still = computePending(updated);
          setPendingSections(still);
          if (still.length > 0) scheduleRefetch();
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
          const still = computePending(mapped);
          setPendingSections(still);
          if (still.length > 0) scheduleRefetch();
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
