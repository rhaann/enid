"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useMemo, useState } from "react";
import { Select } from "@/components/Select";
import { Button } from "@/components/Button";

type ObjectivesKey =
  | "brand_development"
  | "ma_preparation"
  | "funding_round"
  | "competitive_analysis";

type BrandFormData = {
  companyName: string;
  websiteUrl: string;
  email: string;
  objectives: ObjectivesKey[];
  logoFiles?: { name: string; size: number; type: string }[];
  social: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    pinterest?: string;
    youtube?: string;
    tiktok?: string;
  };
  businessGoals?: string;
  competitorUrls: string[];
  targetLocation?: string;
  industry?: string;
  companySize?: string;
  companyStage?:
    | "Idea Stage"
    | "Startup (0\u20132 years)"
    | "Growth Stage (2\u20135 years)"
    | "Established (5+ years)"
    | "Enterprise";
};

const LOGO_UPLOAD_ENABLED = false;
const COMPETITORS_ENABLED = true;

const OBJECTIVES: Array<{
  id: ObjectivesKey;
  title: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    id: "brand_development",
    title: "Brand Development",
    description: "Strengthen brand identity and market positioning",
  },
  {
    id: "ma_preparation",
    title: "M&A Preparation",
    description: "Prepare for mergers, acquisitions, or investment",
  },
  {
    id: "funding_round",
    title: "Funding Round",
    description: "Getting ready for investor presentations",
  },
  {
    id: "competitive_analysis",
    title: "Competitive Analysis",
    description: "Understand your competitive landscape",
  },
];

const emailRegex =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function BrandInputPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [objectives, setObjectives] = useState<ObjectivesKey[]>([]);
  const [logoFiles, setLogoFiles] = useState<File[]>([]);

  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [pinterest, setPinterest] = useState("");
  const [youtube, setYoutube] = useState("");
  const [tiktok, setTiktok] = useState("");

  const [competitors, setCompetitors] = useState<string[]>([""]);
  const [targetLocation, setTargetLocation] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [companyStage, setCompanyStage] = useState<BrandFormData["companyStage"]>();

  const [errors, setErrors] = useState<{ companyName?: string; websiteUrl?: string; email?: string }>(
    {}
  );

  const percent = useMemo(() => {
    if (step === 1) return 33;
    if (step === 2) return 67;
    return 100;
  }, [step]);

  function toggleObjective(id: ObjectivesKey) {
    setObjectives((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  }

  function addCompetitorRow() {
    setCompetitors((prev) => [...prev, ""]);
  }

  function updateCompetitor(index: number, value: string) {
    setCompetitors((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function validateStep1(): boolean {
    const nextErrors: { companyName?: string; websiteUrl?: string; email?: string } = {};
    if (!companyName.trim()) {
      nextErrors.companyName = "Company name is required.";
    }
    if (!websiteUrl.trim()) {
      nextErrors.websiteUrl = "Website URL is required.";
    } else {
      try {
        const trimmed = websiteUrl.trim();
        const normalized =
          /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const parsed = new URL(normalized);
        
        const validHostname = /^[a-zA-Z0-9.-]+$/.test(parsed.hostname);
        if (!parsed.hostname.includes(".") || !validHostname) {
          nextErrors.websiteUrl = "Please enter a valid URL (e.g., https://yourbrand.com).";
        }
      } catch {
        nextErrors.websiteUrl = "Please enter a valid URL (e.g., https://yourbrand.com).";
      }
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          websiteUrl: websiteUrl.trim(),
          email: email.trim(),
          objectives,
          companyStage: companyStage || undefined,
          companySize: companySize || undefined,
          industry: industry.trim() || undefined,
          targetLocation: targetLocation.trim() || undefined,
          competitorUrls: competitors.map((c) => c.trim()).filter((c) => c.length > 0),
          social: {
            linkedin: linkedin.trim() || undefined,
            twitter: twitter.trim() || undefined,
            facebook: facebook.trim() || undefined,
            instagram: instagram.trim() || undefined,
            pinterest: pinterest.trim() || undefined,
            youtube: youtube.trim() || undefined,
            tiktok: tiktok.trim() || undefined,
          },
          logoFiles:
            logoFiles.length > 0
              ? logoFiles.map((f) => ({ name: f.name, size: f.size, type: f.type }))
              : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to submit. Please try again.");
      }

      router.push("/thank-you");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100">
      {/* Top bar */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Logo height={56} />
          <Link
            href="/"
            className="text-sm font-medium text-accent hover:opacity-90"
          >
            Back to Home
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl justify-center px-4 py-10 sm:py-12">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          {/* Progress */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-zinc-600">
              <span>
                Step {step} of 3 &mdash; {percent}% Complete
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <>
              {step === 1 && (
                <section>
                  <h2 className="text-2xl font-semibold text-zinc-900">
                    Let&apos;s Get Started
                  </h2>
                  <p className="mt-1 text-zinc-600">
                    Tell us a bit about your brand so we can tailor your audit.
                  </p>

                  <div className="mt-6 grid gap-5">
                    <div>
                      <label
                        htmlFor="companyName"
                        className="block text-sm font-medium text-zinc-800"
                      >
                        Company Name
                      </label>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        placeholder="Your Company Inc."
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        required
                      />
                      {errors.companyName && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.companyName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="website"
                        className="block text-sm font-medium text-zinc-800"
                      >
                        Website URL
                      </label>
                      <input
                        id="website"
                        name="website"
                        type="url"
                        placeholder="https://yourbrand.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        required
                      />
                      {errors.websiteUrl && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.websiteUrl}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-zinc-800"
                      >
                        Email Address
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        required
                      />
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        if (validateStep1()) setStep(2);
                      }}
                      variant="primary"
                    >
                      Continue &rarr;
                    </Button>
                  </div>
                </section>
              )}

              {step === 2 && (
                <section>
                  <h2 className="text-2xl font-semibold text-zinc-900">
                    What Are Your Objectives?
                  </h2>
                  <p className="mt-1 text-zinc-600">
                    Select all that apply. This helps us tailor the audit to your
                    specific needs.
                  </p>

                  <ul className="mt-6 grid gap-4">
                    {OBJECTIVES.map((item) => {
                      const selected = objectives.includes(item.id);
                      const inputId = `obj-${item.id}`;
                      const isDisabled = item.disabled;
                      return (
                        <li key={item.id}>
                          <label
                            htmlFor={inputId}
                            className={[
                              "group relative block w-full rounded-2xl border p-5 transition",
                              isDisabled
                                ? "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-50"
                                : "cursor-pointer bg-white",
                              !isDisabled && selected
                                ? "border-purple ring-4 ring-purple/20"
                                : !isDisabled
                                  ? "border-zinc-300 hover:border-zinc-400"
                                  : "",
                            ].join(" ")}
                          >
                            <input
                              id={inputId}
                              type="checkbox"
                              className="sr-only"
                              checked={selected}
                              onChange={() => !isDisabled && toggleObjective(item.id)}
                              disabled={isDisabled}
                              aria-checked={selected}
                              aria-label={item.title}
                            />
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className={[
                                  "text-base font-semibold",
                                  isDisabled ? "text-zinc-400" : "text-zinc-900",
                                ].join(" ")}>
                                  {item.title}
                                  {isDisabled && <span className="ml-2 text-xs font-normal">(Coming soon)</span>}
                                </div>
                                <div className={[
                                  "mt-1 text-sm",
                                  isDisabled ? "text-zinc-400" : "text-zinc-600",
                                ].join(" ")}>
                                  {item.description}
                                </div>
                              </div>
                              <span
                                aria-hidden="true"
                                className={[
                                  "mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
                                  isDisabled
                                    ? "border-zinc-200 bg-zinc-100"
                                    : selected
                                      ? "border-purple bg-purple"
                                      : "border-zinc-300 bg-white group-hover:border-zinc-400",
                                ].join(" ")}
                              >
                                <span
                                  className={[
                                    "block h-2.5 w-2.5 rounded-full transition",
                                    selected && !isDisabled ? "bg-white" : "bg-transparent",
                                  ].join(" ")}
                                />
                              </span>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-8 flex items-center justify-between gap-3">
                    <Button type="button" onClick={() => setStep(1)} variant="secondary">
                      Back
                    </Button>
                    <Button type="button" onClick={() => setStep(3)} variant="primary">
                      Continue &rarr;
                    </Button>
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <h2 className="text-2xl font-semibold text-zinc-900">
                    Additional Details
                  </h2>
                  <p className="mt-1 text-zinc-600">
                    All fields below are optional. Share anything else that will help us tailor the audit.
                  </p>

                  <div className="mt-6 grid gap-6">
                    {/* Logo upload (multi-file simulated) */}
                    <div>
                      <label className="block text-sm font-medium text-zinc-800">
                        Brand Logo(s) (Optional)
                      </label>
                      <div className="mt-2">
                        <label
                          htmlFor="logo"
                          {...(LOGO_UPLOAD_ENABLED
                            ? {
                                onDragOver: (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault(),
                                onDrop: (e: React.DragEvent<HTMLLabelElement>) => {
                                  e.preventDefault();
                                  const files = Array.from(e.dataTransfer.files || []);
                                  if (files.length) setLogoFiles((prev) => [...prev, ...files]);
                                },
                              }
                            : {})}
                          aria-disabled={!LOGO_UPLOAD_ENABLED}
                          className={[
                            "flex items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center text-sm",
                            LOGO_UPLOAD_ENABLED
                              ? "cursor-pointer border-zinc-300 bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                              : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-60 pointer-events-none",
                          ].join(" ")}
                          title={LOGO_UPLOAD_ENABLED ? undefined : "Uploads are disabled for now"}
                        >
                          {logoFiles.length > 0 ? (
                            <span className="text-zinc-800">
                              {logoFiles.length} file{logoFiles.length > 1 ? "s" : ""} selected
                            </span>
                          ) : (
                            <span>
                              {LOGO_UPLOAD_ENABLED
                                ? "Drag & drop or click to upload (PNG, JPG, SVG) - multiple allowed"
                                : "Logo uploads are disabled for now"}
                            </span>
                          )}
                          {LOGO_UPLOAD_ENABLED && (
                            <input
                              id="logo"
                              name="logo"
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const list = e.target.files;
                                if (list && list.length > 0) {
                                  setLogoFiles((prev) => [...prev, ...Array.from(list)]);
                                }
                              }}
                            />
                          )}
                        </label>
                        {logoFiles.length > 0 && (
                          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
                            {logoFiles.map((f, idx) => (
                              <li key={`${f.name}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
                                <span className="truncate pr-3 text-zinc-700">{f.name}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLogoFiles((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                                >
                                  Remove
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Social URLs */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-zinc-800">
                          LinkedIn (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://linkedin.com/company/yourbrand"
                          value={linkedin}
                          onChange={(e) => setLinkedin(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-800">
                          Twitter / X (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://x.com/yourbrand"
                          value={twitter}
                          onChange={(e) => setTwitter(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-800">
                          Facebook (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://facebook.com/yourbrand"
                          value={facebook}
                          onChange={(e) => setFacebook(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-800">
                          Instagram (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://instagram.com/yourbrand"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-800">
                          Pinterest (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://pinterest.com/yourbrand"
                          value={pinterest}
                          onChange={(e) => setPinterest(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-800">
                          YouTube (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://youtube.com/@yourbrand"
                          value={youtube}
                          onChange={(e) => setYoutube(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-zinc-800">
                          TikTok (Optional)
                        </label>
                        <input
                          type="url"
                          placeholder="https://tiktok.com/@yourbrand"
                          value={tiktok}
                          onChange={(e) => setTiktok(e.target.value)}
                          className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                        />
                      </div>
                    </div>

                    {/* Company stage */}
                    <div className="grid gap-2">
                      <label className="block text-sm font-medium text-zinc-800">
                        Company Stage (Optional)
                      </label>
                      <Select
                        placeholder="Select your company stage"
                        value={companyStage ?? ""}
                        onChange={(val) =>
                          setCompanyStage((val || undefined) as BrandFormData["companyStage"])
                        }
                        options={[
                          { value: "Idea Stage", label: "Idea Stage" },
                          { value: "Startup (0\u20132 years)", label: "Startup (0\u20132 years)" },
                          { value: "Growth Stage (2\u20135 years)", label: "Growth Stage (2\u20135 years)" },
                          { value: "Established (5+ years)", label: "Established (5+ years)" },
                          { value: "Enterprise", label: "Enterprise" },
                        ]}
                      />
                    </div>

                    {/* Industry */}
                    <div>
                      <label
                        htmlFor="industry"
                        className="block text-sm font-medium text-zinc-800"
                      >
                        Industry (Optional)
                      </label>
                      <input
                        id="industry"
                        name="industry"
                        type="text"
                        placeholder="e.g., Technology, Healthcare, Finance"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                      />
                    </div>

                    {/* Company Size */}
                    <div className="grid gap-2">
                      <label className="block text-sm font-medium text-zinc-800">
                        Company Size (Optional)
                      </label>
                      <Select
                        placeholder="Select your company size"
                        value={companySize}
                        onChange={(val) => setCompanySize(val)}
                        options={[
                          { value: "startup 0-2", label: "Startup (0\u20132 employees)" },
                          { value: "small 1-50", label: "Small (1\u201350 employees)" },
                          { value: "medium 51-200", label: "Medium (51\u2013200 employees)" },
                          { value: "large 201-1000", label: "Large (201\u20131,000 employees)" },
                          { value: "enterprise 1000+", label: "Enterprise (1,000+ employees)" },
                        ]}
                      />
                    </div>

                    {/* Target Location for Competitors */}
                    <div>
                      <label
                        htmlFor="targetLocation"
                        className="block text-sm font-medium text-zinc-800"
                      >
                        Target Location for Competitors (Optional)
                      </label>
                      <p className="mt-1 text-xs text-zinc-500">
                        Specify a region to find competitors in that area (e.g., &quot;Nashville, TN&quot; or &quot;London, UK&quot;).
                        Leave blank to find competitors across all geographies.
                      </p>
                      <input
                        id="targetLocation"
                        name="targetLocation"
                        type="text"
                        placeholder="e.g., Nashville, TN"
                        value={targetLocation}
                        onChange={(e) => setTargetLocation(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                      />
                    </div>

                    {/* Competitor websites */}
                    <div className={COMPETITORS_ENABLED ? "" : "opacity-50"}>
                      <div className="flex items-center justify-between">
                        <label className={[
                          "block text-sm font-medium",
                          COMPETITORS_ENABLED ? "text-zinc-800" : "text-zinc-400",
                        ].join(" ")}>
                          Competitor Websites (Optional)
                          {!COMPETITORS_ENABLED && <span className="ml-2 text-xs font-normal">(Coming soon)</span>}
                        </label>
                        <button
                          type="button"
                          onClick={COMPETITORS_ENABLED ? addCompetitorRow : undefined}
                          disabled={!COMPETITORS_ENABLED}
                          className={[
                            "inline-flex h-8 items-center justify-center rounded-full border px-3 text-sm font-medium",
                            COMPETITORS_ENABLED
                              ? "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                              : "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed",
                          ].join(" ")}
                          aria-label="Add competitor"
                          title={COMPETITORS_ENABLED ? "Add competitor" : "Feature coming soon"}
                        >
                          +
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2">
                        <input
                          type="url"
                          placeholder="https://competitor.com"
                          disabled={!COMPETITORS_ENABLED}
                          className={[
                            "w-full rounded-lg border px-3 py-2 outline-none",
                            COMPETITORS_ENABLED
                              ? "border-zinc-300 bg-white text-zinc-900 ring-purple/20 placeholder:text-zinc-400 focus:border-purple focus:ring-4"
                              : "border-zinc-200 bg-zinc-100 text-zinc-400 placeholder:text-zinc-300 cursor-not-allowed",
                          ].join(" ")}
                        />
                      </div>
                    </div>
                  </div>

                  {submitError && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  )}

                  <div className="mt-8 flex items-center justify-between gap-3">
                    <Button type="button" onClick={() => setStep(2)} variant="secondary">
                      Back
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={isSubmitting} variant="primary">
                      {isSubmitting ? "Submitting..." : "Submit"}
                    </Button>
                  </div>
                </section>
              )}
          </>
        </div>
      </div>
    </div>
  );
}
