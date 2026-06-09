"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Spinner } from "@/components/Spinner";
import { OverlayDialog } from "@/components/OverlayDialog";
import { UserMenu } from "@/components/UserMenu";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";

type AuditStatus = "not_started" | "in_progress" | "done" | "failed";

type BrandAsset = {
  id: string;
  name: string;
  size: string;
  type: string;
};

type ActivityEntry = {
  label: string;
  date: string;
  active: boolean;
};

type AuditRequest = {
  id: string;
  clientName: string;
  clientEmail: string;
  companyName: string;
  companyDomain: string;
  submittedAt: string;
  callDate: string | null;
  callTime: string | null;
  callEndTime: string | null;
  status: string;
  companyStage: string;
  companySize: string;
  industry: string;
  objectives: string[];
  purchased: string[];
  social: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    pinterest?: string;
    youtube?: string;
    tiktok?: string;
  };
  businessGoals: string;
  brandAssets: BrandAsset[];
  competitorWebsites: string[];
  location: string;
  targetLocation: string;
  activity: ActivityEntry[];
  notes: string;
  errorMessage: string;
};

const DONE_STATUS = { label: "Done", color: "text-emerald-700", bg: "bg-emerald-50" };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Not started", color: "text-zinc-600",  bg: "bg-zinc-100" },
  in_progress: { label: "In progress", color: "text-amber-700", bg: "bg-amber-50" },
  done:        DONE_STATUS,
  failed:      { label: "Failed",      color: "text-red-600",   bg: "bg-red-50"   },
};

const FALLBACK_STATUS = { label: "Unknown", color: "text-zinc-500", bg: "bg-zinc-50" };

const SUMMARY_CARDS: { key: AuditStatus; label: string; cardBg: string; numColor: string }[] = [
  { key: "not_started", label: "NOT STARTED", cardBg: "bg-zinc-50 border-zinc-200",         numColor: "text-zinc-800"    },
  { key: "in_progress", label: "IN PROGRESS", cardBg: "bg-amber-50/60 border-amber-200",    numColor: "text-amber-700"  },
  { key: "done",        label: "DONE",        cardBg: "bg-emerald-50/60 border-emerald-200", numColor: "text-emerald-700" },
  { key: "failed",      label: "FAILED",      cardBg: "bg-red-50/60 border-red-200",        numColor: "text-red-600"    },
];

const ASSET_TYPE_COLORS: Record<string, string> = {
  PNG: "bg-blue-100 text-blue-700",
  SVG: "bg-emerald-100 text-emerald-700",
  PDF: "bg-red-100 text-red-700",
  JPG: "bg-amber-100 text-amber-700",
  WEBP: "bg-purple-100 text-purple-700",
};

type SortField = "submittedAt" | "callDate";
type SortDir = "asc" | "desc";

type ParsedAuditError = {
  title: string;
  summary?: string;
  raw?: string;
};

function parseAuditError(raw: string | null | undefined): ParsedAuditError | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^([^:\n]{1,80}):\s*([\s\S]*)$/);
  const title = (match?.[1] ?? "Audit failed").trim();
  const rest = (match?.[2] ?? (match ? "" : trimmed)).trim();

  let parsed: unknown = null;
  if (rest) {
    try {
      parsed = JSON.parse(rest);
    } catch {
      parsed = null;
    }
  }

  let summary: string | undefined;
  let rawDetails: string | undefined;

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const pick = (keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return undefined;
    };
    summary = pick(["message", "error", "reason", "detail", "description"]);
    try {
      rawDetails = JSON.stringify(parsed, null, 2);
    } catch {
      rawDetails = rest;
    }
  } else if (rest && rest !== title) {
    if (rest.length <= 200) summary = rest;
    rawDetails = rest;
  }

  return { title, summary, raw: rawDetails };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function isTomorrow(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d = new Date(dateStr + "T00:00:00");
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = new Date(dateStr + "T00:00:00");
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

/* ─── Detail Side Panel ─── */

const OBJECTIVE_OPTIONS: { id: string; label: string }[] = [
  { id: "brand_development", label: "Brand Development" },
  { id: "ma_preparation", label: "M&A Preparation" },
  { id: "funding_round", label: "Funding Round" },
  { id: "competitive_analysis", label: "Competitive Analysis" },
];

const STAGE_OPTIONS = [
  "Idea Stage",
  "Startup (0–2 years)",
  "Growth Stage (2–5 years)",
  "Established (5+ years)",
  "Enterprise",
];

type EditableFields = {
  companyName: string;
  companyDomain: string;
  clientEmail: string;
  companyStage: string;
  companySize: string;
  industry: string;
  businessGoals: string;
  objectives: string[];
  social: { linkedin?: string; twitter?: string; facebook?: string; instagram?: string; pinterest?: string; youtube?: string; tiktok?: string };
  competitorWebsites: string[];
  location: string;
  targetLocation: string;
  notes: string;
};

function buildEditData(audit: AuditRequest): EditableFields {
  return {
    companyName: audit.companyName,
    companyDomain: audit.companyDomain,
    clientEmail: audit.clientEmail,
    companyStage: audit.companyStage,
    companySize: audit.companySize,
    industry: audit.industry,
    businessGoals: audit.businessGoals,
    objectives: [...audit.objectives],
    social: { ...audit.social },
    competitorWebsites: [...audit.competitorWebsites],
    location: audit.location,
    targetLocation: audit.targetLocation,
    notes: audit.notes,
  };
}

function hasChanges(a: EditableFields, b: EditableFields): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function DetailPanel({
  audit,
  onClose,
  onStatusChange,
  onAuditUpdate,
}: {
  audit: AuditRequest;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onAuditUpdate: (id: string, fields: Partial<AuditRequest>) => void;
}) {
  const router = useRouter();
  const cfg = STATUS_CONFIG[audit.status] ?? FALLBACK_STATUS;
  const extraPurchased = audit.purchased.length > 4 ? audit.purchased.length - 4 : 0;
  const [runningAudit, setRunningAudit] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<Record<string, string>>({});

  const isDone = audit.status === "done";
  const isFailed = audit.status === "failed";
  const canReset = isDone || isFailed;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<EditableFields>(() => buildEditData(audit));
  const originalRef = useRef<EditableFields>(buildEditData(audit));
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const dismissedRef = useRef(false);
  const pollingRef = useRef(false);

  const [localAssets, setLocalAssets] = useState<BrandAsset[]>(audit.brandAssets);
  const [uploading, setUploading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalAssets(audit.brandAssets);
  }, [audit.brandAssets]);

  const UPLOAD_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp", "application/pdf"];
  const UPLOAD_MAX_SIZE = 25 * 1024 * 1024;

  async function handleFileUpload(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const currentCount = localAssets.length;
    if (currentCount + fileArray.length > 10) {
      setRunError(`Maximum 10 files per audit. You have ${currentCount} already.`);
      return;
    }

    for (const file of fileArray) {
      if (!UPLOAD_ALLOWED_TYPES.includes(file.type)) {
        setRunError(`"${file.name}" is not an allowed file type. Use PNG, JPEG, SVG, WebP, or PDF.`);
        return;
      }
      if (file.size > UPLOAD_MAX_SIZE) {
        setRunError(`"${file.name}" exceeds the 25 MB limit.`);
        return;
      }
    }

    setUploading(true);
    setRunError(null);
    try {
      for (const file of fileArray) {
        const form = new FormData();
        form.append("audit_input_id", audit.id);
        form.append("file", file);
        const res = await fetch("/api/assets", { method: "POST", body: form });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.id) {
          const newAsset = { id: json.id, name: json.name, type: json.type, size: json.size };
          setLocalAssets((prev) => {
            const updated = [...prev, newAsset];
            onAuditUpdate(audit.id, { brandAssets: updated });
            return updated;
          });
        } else {
          setRunError(json?.error || "Failed to upload file.");
        }
      }
    } catch {
      setRunError("Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteAsset(assetId: string) {
    setDeletingAssetId(assetId);
    try {
      const res = await fetch(`/api/assets?id=${assetId}`, { method: "DELETE" });
      if (res.ok) {
        const updated = localAssets.filter((a) => a.id !== assetId);
        setLocalAssets(updated);
        onAuditUpdate(audit.id, { brandAssets: updated });
      } else {
        const json = await res.json().catch(() => null);
        setRunError(json?.error || "Failed to delete asset.");
      }
    } catch {
      setRunError("Failed to delete asset.");
    } finally {
      setDeletingAssetId(null);
    }
  }

  const savingRef = useRef(false);

  async function persistChanges(data: EditableFields) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch(`/api/audits/${audit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          companyDomain: data.companyDomain,
          clientEmail: data.clientEmail,
          companyStage: data.companyStage,
          companySize: data.companySize,
          industry: data.industry,
          businessGoals: data.businessGoals,
          objectives: data.objectives,
          linkedin: data.social.linkedin || "",
          twitter: data.social.twitter || "",
          facebook: data.social.facebook || "",
          instagram: data.social.instagram || "",
          pinterest: data.social.pinterest || "",
          youtube: data.social.youtube || "",
          tiktok: data.social.tiktok || "",
          competitorWebsites: data.competitorWebsites.filter((c) => c.trim()),
          location: data.location,
          targetLocation: data.targetLocation,
          notes: data.notes,
        }),
      });
      if (!res.ok) {
        throw new Error("Save failed");
      }
      onAuditUpdate(audit.id, {
        companyName: data.companyName,
        companyDomain: data.companyDomain,
        clientEmail: data.clientEmail,
        companyStage: data.companyStage,
        companySize: data.companySize,
        industry: data.industry,
        businessGoals: data.businessGoals,
        objectives: data.objectives,
        social: data.social,
        competitorWebsites: data.competitorWebsites.filter((c) => c.trim()),
        location: data.location,
        targetLocation: data.targetLocation,
        notes: data.notes,
      });
      originalRef.current = { ...data };
    } catch (e) {
      setRunError("Failed to save changes. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function startEditing() {
    const fresh = buildEditData(audit);
    setEditData(fresh);
    originalRef.current = fresh;
    setEditing(true);
  }

  function cancelEditing() {
    setEditData(originalRef.current);
    setEditing(false);
  }

  async function saveAndStopEditing() {
    if (hasChanges(editData, originalRef.current)) {
      await persistChanges(editData);
    }
    setEditing(false);
  }

  async function handlePanelClose() {
    if (hasChanges(editData, originalRef.current)) {
      await persistChanges(editData);
    }
    onClose();
  }

  async function handleResetAudit() {
    setResetting(true);
    try {
      const res = await fetch(`/api/audits/${audit.id}/reset`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to reset audit.");
      }
      onStatusChange(audit.id, "not_started");
      setShowResetConfirm(false);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Failed to reset audit.");
      setShowResetConfirm(false);
    } finally {
      setResetting(false);
    }
  }

  // Poll the n8n status endpoint until all workflows are done.
  // Used both when triggering a new audit and when reopening
  // a panel for an audit that's already in progress.
  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setRunningAudit(true);

    (async () => {
      try {
        while (pollingRef.current) {
          await new Promise((r) => setTimeout(r, 5000));
          if (!pollingRef.current) break;

          const statusRes = await fetch(`/api/run-audit/status/${audit.id}`);
          const statusJson = await statusRes.json().catch(() => null);

          if (!statusRes.ok) continue;

          if (statusJson?.workflows) {
            setWorkflowStatus(statusJson.workflows);
          }

          // Stop polling when status is terminal (Done or Failed).
          const topStatus = (statusJson?.status ?? "").toLowerCase();
          const stillRunning = !topStatus || topStatus === "in progress" || topStatus === "triggered";
          if (!stillRunning) {
            pollingRef.current = false;
            const isDone = topStatus === "done";
            onStatusChange(audit.id, isDone ? "done" : "failed");
            if (!isDone) {
              const errMsg = statusJson?.errorMessage || "";
              if (errMsg) setRunError(errMsg);
              onAuditUpdate(audit.id, { errorMessage: errMsg });
            }
            if (isDone && !dismissedRef.current) {
              router.push(`/audit?id=${audit.id}`);
            }
            return;
          }
        }
      } catch (e) {
      } finally {
        pollingRef.current = false;
        setRunningAudit(false);
      }
    })();
  }, [audit.id, onStatusChange, router]);

  // If the panel opens and the audit is already in_progress, resume polling
  useEffect(() => {
    if (audit.status === "in_progress") {
      startPolling();
    }
    return () => { pollingRef.current = false; };
  }, [audit.status, startPolling]);

  function handleDismissOverlay() {
    dismissedRef.current = true;
    setRunningAudit(false);
  }

  async function handleRunAudit() {
    setRunningAudit(true);
    setRunError(null);
    setWorkflowStatus({});
    dismissedRef.current = false;

    // Update the list UI to show "In progress" immediately
    onStatusChange(audit.id, "in_progress");

    try {
      const res = await fetch("/api/run-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: audit.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to trigger audit.");
      }

      // Trigger was successful — start polling for status
      startPolling();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to run audit.";
      setRunError(msg);
      setRunningAudit(false);
    }
  }

  function handleSeeAudit() {
    router.push(`/audit?id=${audit.id}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (runningAudit) {
          handleDismissOverlay();
        } else {
          handlePanelClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, runningAudit, editing, editData]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity"
        onClick={handlePanelClose}
      />

      {/* Panel */}
      <div data-panel className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col overflow-hidden bg-zinc-50 shadow-2xl animate-in slide-in-from-right">
        {/* Panel header */}
        <div className="relative bg-navy px-8 pb-6 pt-5">
          <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-[#1a2d3d] opacity-90" />
          <div className="relative flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="truncate text-xl font-semibold text-white">
                  {audit.clientName} &mdash; {audit.companyName}
                </h2>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${cfg.color} ${cfg.bg}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-white/50">
                Submitted {formatDate(audit.submittedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isDone && (
                <button
                  type="button"
                  onClick={handleSeeAudit}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110"
                >
                  See Audit
                </button>
              )}
              {audit.status === "not_started" && (
                <button
                  type="button"
                  onClick={handleRunAudit}
                  disabled={runningAudit}
                  className="rounded-lg border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {runningAudit ? "Running..." : "Run audit"}
                </button>
              )}
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveAndStopEditing}
                    disabled={saving}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                !isDone && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Edit
                  </button>
                )
              )}
              {canReset && !editing && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/25"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={handlePanelClose}
                className="rounded-lg p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Close panel"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {(() => {
          const parsed: ParsedAuditError | null = runError
            ? { title: "Error", summary: runError }
            : isFailed && audit.errorMessage
            ? parseAuditError(audit.errorMessage)
            : null;
          if (!parsed) return null;
          return (
            <div className="mx-8 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-semibold">{parsed.title}</p>
              {parsed.summary && <p className="mt-1">{parsed.summary}</p>}
              {parsed.raw && (
                <details className="mt-2">
                  <summary className="cursor-pointer select-none text-xs font-medium text-red-600/80 hover:text-red-700">
                    Show raw details
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-red-200 bg-white/60 p-2 text-[11px] leading-snug text-red-900/90">
                    {parsed.raw}
                  </pre>
                </details>
              )}
            </div>
          );
        })()}

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
            {/* Left column */}
            <div className="p-8">
              {/* Purchased */}
              <Section title="Purchased">
                {audit.purchased.length === 0 ? (
                  <p className="text-sm italic text-zinc-400">No tiers purchased yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {audit.purchased.slice(0, 4).map((p) => (
                      <span key={p} className="rounded-full border border-navy/15 bg-navy/5 px-3.5 py-1.5 text-xs font-medium text-navy">
                        {p}
                      </span>
                    ))}
                    {extraPurchased > 0 && (
                      <span className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-500">
                        +{extraPurchased} more
                      </span>
                    )}
                  </div>
                )}
              </Section>

              {/* Company info */}
              <Section title="Company Info">
                <div className="grid grid-cols-2 gap-3">
                  {editing ? (
                    <>
                      <EditableInfoCard label="Company Name" value={editData.companyName} onChange={(v) => setEditData((d) => ({ ...d, companyName: v }))} />
                      <EditableInfoCard label="Website" value={editData.companyDomain} onChange={(v) => setEditData((d) => ({ ...d, companyDomain: v }))} type="url" />
                      <EditableInfoCard label="Company Stage" value={editData.companyStage} onChange={(v) => setEditData((d) => ({ ...d, companyStage: v }))} options={STAGE_OPTIONS} />
                      <EditableInfoCard label="Company Size" value={editData.companySize} onChange={(v) => setEditData((d) => ({ ...d, companySize: v }))} />
                      <EditableInfoCard label="Industry" value={editData.industry} onChange={(v) => setEditData((d) => ({ ...d, industry: v }))} />
                      <EditableInfoCard label="Business Goals" value={editData.businessGoals} onChange={(v) => setEditData((d) => ({ ...d, businessGoals: v }))} />
                      <EditableInfoCard label="Contact Email" value={editData.clientEmail} onChange={(v) => setEditData((d) => ({ ...d, clientEmail: v }))} type="email" />
                      <EditableInfoCard label="Location" value={editData.location} onChange={(v) => setEditData((d) => ({ ...d, location: v }))} />
                    </>
                  ) : (
                    <>
                      <InfoCard label="Company Name" value={audit.companyName || "\u2014"} />
                      <InfoCard label="Website" value={audit.companyDomain || "\u2014"} href={audit.companyDomain ? (audit.companyDomain.startsWith("http") ? audit.companyDomain : `https://${audit.companyDomain}`) : undefined} />
                      <InfoCard label="Company Stage" value={audit.companyStage || "\u2014"} />
                      <InfoCard label="Company Size" value={audit.companySize || "\u2014"} />
                      <InfoCard label="Industry" value={audit.industry || "\u2014"} />
                      <InfoCard label="Business Goals" value={audit.businessGoals || "\u2014"} />
                      <InfoCard label="Contact Email" value={audit.clientEmail || "\u2014"} />
                      <InfoCard label="Location" value={audit.location || "\u2014"} />
                    </>
                  )}
                </div>
              </Section>

              {/* Audit Objectives */}
              <Section title="Audit Objectives">
                {editing ? (
                  <div className="flex flex-wrap gap-2">
                    {OBJECTIVE_OPTIONS.map((opt) => {
                      const selected = editData.objectives.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setEditData((d) => ({
                              ...d,
                              objectives: selected
                                ? d.objectives.filter((o) => o !== opt.id)
                                : [...d.objectives, opt.id],
                            }))
                          }
                          className={[
                            "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                            selected
                              ? "border-accent bg-accent text-white"
                              : "border-zinc-300 bg-white text-zinc-600 hover:border-accent hover:text-accent",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                ) : audit.objectives.length === 0 ? (
                  <p className="text-sm italic text-zinc-400">None selected</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {audit.objectives.map((o) => {
                      const label = OBJECTIVE_OPTIONS.find((opt) => opt.id === o)?.label ?? o;
                      return (
                        <span key={o} className="rounded-full border border-accent/25 bg-accent/8 px-3.5 py-1.5 text-xs font-semibold text-accent">
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* Brand Assets */}
              <Section title="Brand Assets">
                {localAssets.length === 0 && !uploading ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center">
                    <p className="text-sm text-zinc-400">No assets uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {localAssets.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase ${ASSET_TYPE_COLORS[a.type] ?? "bg-zinc-100 text-zinc-600"}`}>
                            {a.type}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-800">{a.name}</p>
                            <p className="text-xs text-zinc-400">{a.size}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/api/assets/download/${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-accent bg-accent/5 px-4 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-white"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteAsset(a.id)}
                            disabled={deletingAssetId === a.id}
                            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                            aria-label="Delete asset"
                          >
                            {deletingAssetId === a.id ? (
                              <Spinner size={14} />
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Upload zone */}
                <div className="mt-3">
                  <label
                    htmlFor="asset-upload"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
                    }}
                    className={[
                      "flex cursor-pointer items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center text-sm transition",
                      uploading
                        ? "border-accent/40 bg-accent/5 text-accent"
                        : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-accent hover:bg-accent/5 hover:text-accent",
                    ].join(" ")}
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2"><Spinner size={14} /> Uploading...</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Drop files here or click to upload
                      </span>
                    )}
                    <input
                      ref={fileInputRef}
                      id="asset-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp,application/pdf"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) handleFileUpload(e.target.files);
                      }}
                    />
                  </label>
                  <p className="mt-1 text-[10px] text-zinc-400">PNG, JPG, SVG, WebP, PDF &middot; Max 25 MB each &middot; Up to 10 files</p>
                </div>
              </Section>

              {/* Social Media */}
              <Section title="Social Media">
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                  {(["linkedin", "twitter", "facebook", "instagram", "pinterest", "youtube", "tiktok"] as const).map((key, i, arr) => {
                    const labels: Record<string, string> = { linkedin: "LinkedIn", twitter: "Twitter / X", facebook: "Facebook", instagram: "Instagram", pinterest: "Pinterest", youtube: "YouTube", tiktok: "TikTok" };
                    const val = editing ? (editData.social[key] ?? "") : audit.social[key];
                    return (
                      <div
                        key={key}
                        className={[
                          "flex items-center gap-4 px-4 py-3",
                          i < arr.length - 1 ? "border-b border-zinc-100" : "",
                        ].join(" ")}
                      >
                        <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          {labels[key]}
                        </span>
                        {editing ? (
                          <input
                            type="url"
                            value={val ?? ""}
                            onChange={(e) =>
                              setEditData((d) => ({
                                ...d,
                                social: { ...d.social, [key]: e.target.value },
                              }))
                            }
                            placeholder={`https://${key === "twitter" ? "x" : key}.com/...`}
                            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
                          />
                        ) : val ? (
                          <a href={val.startsWith("http") ? val : `https://${val}`} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                            {val}
                          </a>
                        ) : (
                          <span className="text-sm italic text-zinc-400">Not provided</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Competitor Websites */}
              <Section title="Competitor Websites">
                {editing ? (
                  <>
                    <div className="mb-3">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Target Location</label>
                      <input
                        type="text"
                        value={editData.targetLocation}
                        onChange={(e) => setEditData((d) => ({ ...d, targetLocation: e.target.value }))}
                        placeholder="e.g. United States"
                        className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
                      />
                    </div>
                    <div className="space-y-2">
                      {editData.competitorWebsites.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="url"
                            value={c}
                            onChange={(e) =>
                              setEditData((d) => ({
                                ...d,
                                competitorWebsites: d.competitorWebsites.map((v, i) => (i === idx ? e.target.value : v)),
                              }))
                            }
                            placeholder="https://competitor.com"
                            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditData((d) => ({
                                ...d,
                                competitorWebsites: d.competitorWebsites.filter((_, i) => i !== idx),
                              }))
                            }
                            className="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                            aria-label="Remove competitor"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditData((d) => ({ ...d, competitorWebsites: [...d.competitorWebsites, ""] }))}
                        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:border-accent hover:text-accent"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add Competitor
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {audit.targetLocation && (
                      <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 shadow-sm">
                        <svg className="h-3.5 w-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Target Location</span>
                        <span className="text-sm font-semibold text-zinc-800">{audit.targetLocation}</span>
                      </div>
                    )}
                    {audit.competitorWebsites.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center">
                        <p className="text-sm text-zinc-400">None provided</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {audit.competitorWebsites.map((c) => (
                          <div key={c} className="flex items-center gap-2 rounded-xl border border-accent/15 bg-accent/5 px-4 py-2.5">
                            <svg className="h-3.5 w-3.5 shrink-0 text-accent/50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                            </svg>
                            <span className="text-sm font-medium text-accent">{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Section>
            </div>

            {/* Right column */}
            <div className="border-l border-zinc-200 bg-white p-8">
              {/* Client Call */}
              <Section title="Client Call">
                {audit.callDate ? (
                  <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-accent">Scheduled</p>
                    <p className="mt-2 text-xl font-semibold text-zinc-900">
                      {formatDateLong(audit.callDate)}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {audit.callTime}{audit.callEndTime ? ` \u2013 ${audit.callEndTime}` : ""}
                    </p>
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-accent/8 px-3 py-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                      <span className="text-xs text-zinc-600">Synced from Calendly</span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-accent hover:underline"
                    >
                      Open in Calendly &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
                    <svg className="mx-auto h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <p className="mt-2 text-sm text-zinc-400">No call scheduled</p>
                  </div>
                )}
              </Section>

              {/* Activity */}
              <Section title="Activity">
                {audit.activity.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center">
                    <p className="text-sm text-zinc-400">No activity yet</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-5">
                    {audit.activity.map((a, i) => (
                      <div key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
                        {i < audit.activity.length - 1 && (
                          <div className="absolute left-[7px] top-5 bottom-0 w-px bg-zinc-200" />
                        )}
                        <span className={[
                          "relative mt-0.5 h-4 w-4 shrink-0 rounded-full border-2",
                          a.active ? "border-accent bg-accent shadow-sm shadow-accent/30" : "border-zinc-300 bg-white",
                        ].join(" ")} />
                        <div>
                          <p className="text-sm font-medium text-zinc-800">{a.label}</p>
                          <p className="mt-0.5 text-xs text-zinc-400">{a.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Internal Notes — always editable */}
              <Section title="Internal Notes">
                <textarea
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 transition focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
                  rows={5}
                  placeholder="Add notes about this audit..."
                  value={editData.notes}
                  onChange={(e) => setEditData((d) => ({ ...d, notes: e.target.value }))}
                  onBlur={(e) => {
                    const panelEl = e.currentTarget.closest("[data-panel]");
                    const relatedInPanel = e.relatedTarget && panelEl?.contains(e.relatedTarget as Node);
                    if (relatedInPanel && editData.notes !== originalRef.current.notes) {
                      persistChanges(editData);
                    }
                  }}
                />
              </Section>
            </div>
          </div>
        </div>
      </div>

      {/* Generating Audit overlay with per-workflow progress */}
      <OverlayDialog open={runningAudit} size="md" onClose={handleDismissOverlay}>
        <div className="flex flex-col items-center py-6">
          <Spinner size={48} />
          <h3 className="mt-6 text-xl font-semibold text-zinc-900">
            Generating Your Audit
          </h3>
          <p className="mt-2 text-sm text-zinc-500 text-center max-w-xs">
            This usually takes 2&ndash;4 minutes. We&apos;ll show progress as each workflow completes.
          </p>

          {/* Per-workflow status list */}
          {Object.keys(workflowStatus).length > 0 && (
            <div className="mt-5 w-full max-w-xs space-y-2">
              {Object.entries(workflowStatus).map(([name, status]) => {
                const s = status.toLowerCase();
                const isDone = s === "done";
                const isError = s === "failed" || s === "error";
                return (
                  <div key={name} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
                    <span className="text-sm font-medium text-zinc-700">{name}</span>
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      {isDone && (
                        <>
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="text-green-600">Done</span>
                        </>
                      )}
                      {isError && (
                        <>
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          <span className="text-red-600">Error</span>
                        </>
                      )}
                      {!isDone && !isError && (
                        <>
                          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                          <span className="text-zinc-400">In Progress</span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fallback when no workflow status yet (waiting for first poll) */}
          {Object.keys(workflowStatus).length === 0 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
              <span className="text-xs text-zinc-400">Starting workflows&hellip;</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleDismissOverlay}
            className="mt-5 text-sm font-medium text-accent hover:underline"
          >
            Continue in background
          </button>
        </div>
      </OverlayDialog>

      {/* Reset confirmation dialog */}
      <OverlayDialog
        open={showResetConfirm}
        size="md"
        onClose={() => setShowResetConfirm(false)}
        title="Reset Audit"
        tone="danger"
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              disabled={resetting}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResetAudit}
              disabled={resetting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {resetting ? "Resetting..." : "Reset & Clear Results"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-700">
            This will <strong>permanently delete</strong> all existing audit results for <strong>{audit.companyName}</strong> and reset the status so it can be re-run.
          </p>
          <p className="text-sm text-zinc-500">
            This action cannot be undone. The following data will be removed:
          </p>
          <ul className="list-disc pl-5 text-sm text-zinc-600 space-y-1">
            <li>Brand evaluation results</li>
            <li>Website evaluation results</li>
            <li>Social media analysis results</li>
            <li>Competitor analysis results</li>
            <li>Scraped website data</li>
          </ul>
        </div>
      </OverlayDialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function InfoCard({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm overflow-hidden">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-sm font-semibold text-accent hover:underline" title={value}>
          {value}
        </a>
      ) : (
        <p className="mt-1 truncate text-sm font-semibold text-zinc-800" title={value}>{value}</p>
      )}
    </div>
  );
}

function EditableInfoCard({
  label,
  value,
  onChange,
  type = "text",
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "url";
  options?: string[];
}) {
  return (
    <div className="rounded-xl border border-accent/20 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm font-semibold text-zinc-800 outline-none focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
        >
          <option value="">—</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm font-semibold text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20"
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [audits, setAudits] = useState<AuditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function fetchAudits() {
      try {
        const res = await fetch("/api/audits");
        if (!res.ok) throw new Error("Failed to load audits.");
        const data = await res.json();
        setAudits(data);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : "Failed to load audits.");
      } finally {
        setLoading(false);
      }
    }
    fetchAudits();
  }, []);

  const selectedAudit = useMemo(
    () => (selectedId ? audits.find((r) => r.id === selectedId) ?? null : null),
    [selectedId, audits]
  );

  const handleClosePanel = useCallback(() => setSelectedId(null), []);

  async function handleDeleteAudit() {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/audits/${deleteConfirmId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to delete audit.");
      }
      setAudits((prev) => prev.filter((a) => a.id !== deleteConfirmId));
      if (selectedId === deleteConfirmId) setSelectedId(null);
      setDeleteConfirmId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete audit.");
    } finally {
      setDeleting(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { not_started: 0, in_progress: 0, done: 0, failed: 0 };
    for (const r of audits) {
      const normalized = r.status;
      if (c[normalized] !== undefined) c[normalized]++;
      else c.not_started++;
    }
    return c;
  }, [audits]);

  const filtered = useMemo(() => {
    let rows = [...audits];

    if (statusFilter !== "all") {
      rows = rows.filter((r) => {
        if (statusFilter === "done") return r.status === "done";
        return r.status === statusFilter;
      });
    }

    if (dateFilter !== "all") {
      const now = new Date();
      rows = rows.filter((r) => {
        const d = new Date(r.submittedAt + "T00:00:00");
        if (dateFilter === "7d") return now.getTime() - d.getTime() <= 7 * 86400000;
        if (dateFilter === "30d") return now.getTime() - d.getTime() <= 30 * 86400000;
        if (dateFilter === "90d") return now.getTime() - d.getTime() <= 90 * 86400000;
        return true;
      });
    }

    // Search matches across all 4 fields: client name, email, company name, and domain
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.clientName.toLowerCase().includes(q) ||
          r.clientEmail.toLowerCase().includes(q) ||
          r.companyName.toLowerCase().includes(q) ||
          r.companyDomain.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [audits, statusFilter, dateFilter, search, sortField, sortDir]);

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0);
  }, [statusFilter, dateFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    const active = sortField === field;
    return (
      <span className="ml-1 inline-flex flex-col text-[10px] leading-none">
        <span className={active && sortDir === "asc" ? "text-navy" : "text-zinc-300"}>&uarr;</span>
        <span className={active && sortDir === "desc" ? "text-navy" : "text-zinc-300"}>&darr;</span>
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <Logo height={56} />
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-medium text-accent hover:opacity-90">
              Back to Home
            </Link>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-zinc-900">Enid Audit Queue</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {audits.length} total request{audits.length !== 1 ? "s" : ""}
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Spinner size={32} />
              <p className="mt-4 text-sm text-zinc-500">Loading audits...</p>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-24">
              <p className="text-sm text-red-600">{fetchError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 text-sm font-medium text-accent hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {SUMMARY_CARDS.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === card.key ? "all" : card.key)}
                    className={[
                      "rounded-xl border p-4 text-left transition",
                      card.cardBg,
                      statusFilter === card.key ? "ring-2 ring-accent" : "",
                    ].join(" ")}
                  >
                    <p className="text-xs font-semibold tracking-wide text-zinc-500">{card.label}</p>
                    <p className={`mt-1 text-2xl font-bold ${card.numColor}`}>{counts[card.key]}</p>
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div className="mb-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-56 appearance-none rounded-lg border border-zinc-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2371717a%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.22%206.22a.75.75%200%20011.06%200L8%208.94l2.72-2.72a.75.75%200%20111.06%201.06l-3.25%203.25a.75.75%200%2001-1.06%200L4.22%207.28a.75.75%200%20010-1.06z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat py-2 pl-3 pr-9 text-sm text-zinc-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="all">All</option>
                    <option value="not_started">Not started</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700">Date</span>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-56 appearance-none rounded-lg border border-zinc-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%2371717a%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.22%206.22a.75.75%200%20011.06%200L8%208.94l2.72-2.72a.75.75%200%20111.06%201.06l-3.25%203.25a.75.75%200%2001-1.06%200L4.22%207.28a.75.75%200%20010-1.06z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat py-2 pl-3 pr-9 text-sm text-zinc-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="all">All Time</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>
                </div>

                <div className="relative ml-auto">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-56 rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200">
                      <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Client
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Company
                      </th>
                      <th
                        className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500"
                        onClick={() => toggleSort("submittedAt")}
                      >
                        Submitted <SortIcon field="submittedAt" />
                      </th>
                      <th
                        className="cursor-pointer whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500"
                        onClick={() => toggleSort("callDate")}
                      >
                        Call Date <SortIcon field="callDate" />
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Status
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                          {audits.length === 0 ? "No audit requests yet." : "No requests match your filters."}
                        </td>
                      </tr>
                    )}
                    {paginated.map((row) => {
                      const tomorrow = isTomorrow(row.callDate);
                      const today = isToday(row.callDate);
                      const urgentRow = tomorrow || today;
                      const cfg = STATUS_CONFIG[row.status] ?? FALLBACK_STATUS;

                      return (
                        <tr
                          key={row.id}
                          className={[
                            "border-b border-zinc-100 transition hover:bg-zinc-50",
                            urgentRow ? "bg-amber-50/40" : "",
                            selectedId === row.id ? "bg-accent/5" : "",
                          ].join(" ")}
                        >
                          <td className="max-w-[200px] px-4 py-3">
                            <div className="truncate font-medium text-zinc-900">{row.clientName}</div>
                            <div className="truncate text-xs text-zinc-500" title={row.clientEmail}>{row.clientEmail}</div>
                            {tomorrow && (
                              <span className="mt-1 inline-block rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gold">
                                Tomorrow
                              </span>
                            )}
                            {today && (
                              <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                                Today
                              </span>
                            )}
                          </td>
                          <td className="max-w-[200px] px-4 py-3">
                            <div className="truncate font-medium text-zinc-900">{row.companyName}</div>
                            <div className="truncate text-xs text-zinc-500" title={row.companyDomain}>{row.companyDomain}</div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                            {row.submittedAt ? formatDate(row.submittedAt) : "\u2014"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                            {row.callDate ? (
                              <>
                                <div>{formatDate(row.callDate)}</div>
                                {row.callTime && (
                                  <div className="text-xs text-zinc-500">{row.callTime}</div>
                                )}
                              </>
                            ) : (
                              <span className="text-zinc-400">&mdash;</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cfg.color} ${cfg.bg}`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedId(row.id)}
                                className="inline-flex rounded-lg border border-zinc-300 bg-white px-4 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
                              >
                                Open
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(row.id); }}
                                className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-500"
                                aria-label="Delete audit"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
                  <p className="text-sm text-zinc-500">
                    Showing {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage(0)}
                      className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      First
                    </button>
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      &larr; Prev
                    </button>
                    {(() => {
                      const pages: (number | "...")[] = [];
                      if (totalPages <= 7) {
                        for (let i = 0; i < totalPages; i++) pages.push(i);
                      } else {
                        pages.push(0);
                        if (page > 2) pages.push("...");
                        for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
                        if (page < totalPages - 3) pages.push("...");
                        pages.push(totalPages - 1);
                      }
                      return pages.map((p, idx) =>
                        p === "..." ? (
                          <span key={`ellipsis-${idx}`} className="px-1 text-sm text-zinc-400">&hellip;</span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPage(p)}
                            className={[
                              "min-w-[32px] rounded-md px-2 py-1.5 text-sm font-medium",
                              p === page
                                ? "bg-accent text-white"
                                : "text-zinc-600 hover:bg-zinc-100",
                            ].join(" ")}
                          >
                            {p + 1}
                          </button>
                        )
                      );
                    })()}
                    <button
                      type="button"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      Next &rarr;
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(totalPages - 1)}
                      className="rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <OverlayDialog
          open={!!deleteConfirmId}
          size="md"
          onClose={() => setDeleteConfirmId(null)}
          title="Delete Audit"
          tone="danger"
          actions={
            <>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAudit}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          }
        >
          <p className="text-sm text-zinc-700">
            This will <strong>permanently delete</strong> the audit for{" "}
            <strong>{audits.find((a) => a.id === deleteConfirmId)?.companyName ?? "this client"}</strong>{" "}
            and all associated data. This cannot be undone.
          </p>
        </OverlayDialog>
      )}

      {/* Detail side panel */}
      {selectedAudit && (
        <DetailPanel
          audit={selectedAudit}
          onClose={handleClosePanel}
          onStatusChange={(id, status) => {
            setAudits((prev) =>
              prev.map((a) => (a.id === id ? { ...a, status } : a))
            );
          }}
          onAuditUpdate={(id, fields) => {
            setAudits((prev) =>
              prev.map((a) => (a.id === id ? { ...a, ...fields } : a))
            );
          }}
        />
      )}
    </div>
  );
}
