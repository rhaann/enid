"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Logo } from "@/components/Logo";

// ── Types & constants ─────────────────────────────────────────────────────────

type ObjectiveKey =
  | "brand_development"
  | "ma_preparation"
  | "funding_round"
  | "competitive_analysis";

const OBJECTIVES: { id: ObjectiveKey; label: string }[] = [
  { id: "brand_development",    label: "Brand Development"   },
  { id: "ma_preparation",       label: "M&A Preparation"     },
  { id: "funding_round",        label: "Funding Round"       },
  { id: "competitive_analysis", label: "Competitive Analysis" },
];

const STAGES = [
  { label: "Pre-launch / Concept", value: "Pre-launch / Concept"     },
  { label: "0–2 years",            value: "Startup (0–2 years)"      },
  { label: "2–5 years",            value: "Growth Stage (2–5 years)" },
  { label: "5–10 years",           value: "Established (5–10 years)" },
  { label: "10+ / Enterprise",     value: "Enterprise"               },
];

const SOCIAL_PLATFORMS = [
  { key: "linkedin"  as const, label: "LinkedIn",    placeholder: "https://linkedin.com/company/..." },
  { key: "twitter"   as const, label: "X / Twitter", placeholder: "https://x.com/..."               },
  { key: "facebook"  as const, label: "Facebook",    placeholder: "https://facebook.com/..."         },
  { key: "instagram" as const, label: "Instagram",   placeholder: "https://instagram.com/..."        },
  { key: "youtube"   as const, label: "YouTube",     placeholder: "https://youtube.com/@..."         },
  { key: "tiktok"    as const, label: "TikTok",      placeholder: "https://tiktok.com/@..."          },
  { key: "pinterest" as const, label: "Pinterest",   placeholder: "https://pinterest.com/..."        },
];

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BrandInputPage() {
  const router = useRouter();

  const [companyName,    setCompanyName]    = useState("");
  const [websiteUrl,     setWebsiteUrl]     = useState("");
  const [email,          setEmail]          = useState("");
  const [location,       setLocation]       = useState("");
  const [industry,       setIndustry]       = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [companySize,    setCompanySize]    = useState("");
  const [companyStage,   setCompanyStage]   = useState("");
  const [objectives,     setObjectives]     = useState<ObjectiveKey[]>([]);
  const [competitors,    setCompetitors]    = useState(["", "", "", ""]);
  const [activeSocials,  setActiveSocials]  = useState<Set<string>>(new Set());
  const [socialUrls,     setSocialUrls]     = useState<Record<string, string>>({});

  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  function toggleObjective(id: ObjectiveKey) {
    setObjectives((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  }

  function toggleSocial(key: string) {
    setActiveSocials((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setSocialUrls((urls) => {
          const u = { ...urls };
          delete u[key];
          return u;
        });
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) {
      errs.companyName = "Required";
    }
    if (!websiteUrl.trim()) {
      errs.websiteUrl = "Required";
    } else {
      try {
        const normalized = /^https?:\/\//i.test(websiteUrl.trim())
          ? websiteUrl.trim()
          : `https://${websiteUrl.trim()}`;
        const parsed = new URL(normalized);
        if (!parsed.hostname.includes(".")) errs.websiteUrl = "Enter a valid URL";
      } catch {
        errs.websiteUrl = "Enter a valid URL";
      }
    }
    if (!email.trim()) {
      errs.email = "Required";
    } else if (!emailRegex.test(email.trim())) {
      errs.email = "Enter a valid email";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName:    companyName.trim(),
          websiteUrl:     websiteUrl.trim(),
          email:          email.trim(),
          location:       location.trim()       || undefined,
          industry:       industry.trim()       || undefined,
          targetLocation: targetLocation.trim() || undefined,
          companyStage:   companyStage          || undefined,
          companySize:    companySize           || undefined,
          objectives:     objectives.length > 0 ? objectives : undefined,
          competitorUrls: competitors.map((c) => c.trim()).filter(Boolean),
          social: Object.fromEntries(
            Object.entries(socialUrls).filter(([, v]) => v?.trim())
          ),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to submit. Please try again.");
      }
      router.push("/dashboard");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* ── Header ── */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Logo height={56} />
          <Link
            href="/dashboard"
            className="text-sm font-medium text-accent hover:opacity-90"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto w-full max-w-3xl px-4 py-10 pb-24">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-900">New Brand Audit</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Fill in the details below to queue a test audit. No emails will be sent.
          </p>
        </div>

        <div className="space-y-6">

          {/* ── Company Info ── */}
          <Card title="Company Info">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel required>Company Name</FieldLabel>
                <LightInput
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); clearError("companyName"); }}
                  error={errors.companyName}
                />
              </div>
              <div>
                <FieldLabel required>Website URL</FieldLabel>
                <LightInput
                  type="url"
                  placeholder="https://yourbrand.com"
                  value={websiteUrl}
                  onChange={(e) => { setWebsiteUrl(e.target.value); clearError("websiteUrl"); }}
                  error={errors.websiteUrl}
                />
              </div>
              <div>
                <FieldLabel required>Email Address</FieldLabel>
                <LightInput
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                  error={errors.email}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Location</FieldLabel>
                <LightInput
                  placeholder="e.g. Nashville, TN"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* ── Business Stage ── */}
          <Card title="Business Stage">
            <div className="flex flex-wrap gap-2.5">
              {STAGES.map((stage) => (
                <PillButton
                  key={stage.value}
                  label={stage.label}
                  selected={companyStage === stage.value}
                  onClick={() =>
                    setCompanyStage(companyStage === stage.value ? "" : stage.value)
                  }
                />
              ))}
            </div>
          </Card>

          {/* ── Objectives ── */}
          <Card title="Objectives" subtitle="Select all that apply">
            <div className="flex flex-wrap gap-2.5">
              {OBJECTIVES.map((obj) => (
                <PillButton
                  key={obj.id}
                  label={obj.label}
                  selected={objectives.includes(obj.id)}
                  onClick={() => toggleObjective(obj.id)}
                />
              ))}
            </div>
          </Card>

          {/* ── Social Media ── */}
          <Card title="Social Media" subtitle="Check a platform to add its URL">
            <div className="space-y-3">
              {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => toggleSocial(key)}
                    className="group flex items-center gap-3"
                  >
                    <span
                      className={[
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition",
                        activeSocials.has(key)
                          ? "border-accent bg-accent"
                          : "border-zinc-300 bg-white group-hover:border-zinc-400",
                      ].join(" ")}
                    >
                      {activeSocials.has(key) && (
                        <svg
                          className="h-3 w-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={3}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      )}
                    </span>
                    <span
                      className={[
                        "text-sm font-medium transition",
                        activeSocials.has(key)
                          ? "text-zinc-900"
                          : "text-zinc-600 group-hover:text-zinc-800",
                      ].join(" ")}
                    >
                      {label}
                    </span>
                  </button>
                  {activeSocials.has(key) && (
                    <div className="mt-2 pl-8">
                      <LightInput
                        type="url"
                        placeholder={placeholder}
                        value={socialUrls[key] ?? ""}
                        onChange={(e) =>
                          setSocialUrls((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ── Additional Details ── */}
          <Card title="Additional Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Industry</FieldLabel>
                <LightInput
                  placeholder="e.g. Technology, Healthcare"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                />
              </div>
              <div>
                <FieldLabel>Company Size</FieldLabel>
                <LightSelect
                  value={companySize}
                  onChange={setCompanySize}
                  placeholder="Select size"
                  options={[
                    { value: "startup 0-2",     label: "Startup (0–2 employees)"       },
                    { value: "small 1-50",       label: "Small (1–50 employees)"        },
                    { value: "medium 51-200",    label: "Medium (51–200 employees)"     },
                    { value: "large 201-1000",   label: "Large (201–1,000 employees)"   },
                    { value: "enterprise 1000+", label: "Enterprise (1,000+ employees)" },
                  ]}
                />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Target Location for Competitors</FieldLabel>
                <p className="mb-2 text-xs text-zinc-500">
                  Specify a region to find local competitors (e.g. &quot;Nashville, TN&quot;). Leave blank for global.
                </p>
                <LightInput
                  placeholder="e.g. Nashville, TN"
                  value={targetLocation}
                  onChange={(e) => setTargetLocation(e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* ── Competitors ── */}
          <Card title="Competitor Websites" subtitle="Optional — up to 4 URLs">
            <div className="space-y-3">
              {competitors.map((url, idx) => (
                <LightInput
                  key={idx}
                  type="url"
                  placeholder={`https://competitor${idx + 1}.com`}
                  value={url}
                  onChange={(e) =>
                    setCompetitors((prev) =>
                      prev.map((v, i) => (i === idx ? e.target.value : v))
                    )
                  }
                />
              ))}
            </div>
          </Card>

        </div>

        {submitError && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-xl bg-accent px-8 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-sm font-medium text-zinc-800">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );
}

function LightInput({
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div>
      <input
        {...props}
        className={[
          "w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 transition",
          error
            ? "border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
            : "border-zinc-300 focus:border-accent focus:ring-4 focus:ring-accent/10",
          className ?? "",
        ].join(" ")}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function LightSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PillButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-1.5 text-sm font-medium transition",
        selected
          ? "border-accent bg-accent/10 text-accent"
          : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-800",
      ].join(" ")}
    >
      {selected && <span className="mr-1.5">✓</span>}
      {label}
    </button>
  );
}
