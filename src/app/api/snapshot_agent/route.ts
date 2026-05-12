/**
 * @file route.ts
 * POST /api/snapshot_agent
 * DELETE /api/snapshot_agent
 *
 * Snapshot Agent — generates a concise executive Brand Snapshot PDF for a
 * completed audit. The route:
 *   1. Checks dlb_snapshot_results for a cached synthesis — if found, skips
 *      steps 2-4 and goes straight to PDF rendering.
 *   2. Fetches all available audit result rows from Supabase.
 *   3. Calculates the Enid Score (plain TypeScript average of all numeric scores).
 *   4. Runs two Tavily searches to determine SEO / visibility presence.
 *   5. Calls Claude (claude-sonnet-4-6) to synthesise the structured snapshot.
 *   6. Saves the synthesis to dlb_snapshot_results for future requests.
 *   7. Renders a PDF with @react-pdf/renderer and returns it as a download.
 *
 * DELETE clears the cached snapshot row so the next POST triggers a fresh run.
 *
 * Auth: requires an admin browser session (requireAdmin).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { pdf } from "@react-pdf/renderer";
import React from "react";
import path from "path";
import { requireAdmin } from "@/lib/supabase/auth";
import { SnapshotDocument } from "@/components/SnapshotPDFTemplate";
import { SNAPSHOT_SYSTEM_PROMPT } from "./prompts";
import type {
  SnapshotPDFData,
  SnapshotResult,
  SeoVisibility,
} from "@/components/SnapshotPDFTemplate";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Absolute path to the Enid logo for server-side PDF rendering. */
const LOGO_PATH = path.join(process.cwd(), "public", "Enid_Wordmark_Full_Color.png");

/** Known social media domains used to classify search result URLs. */
const SOCIAL_DOMAINS = [
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "threads.net",
  "reddit.com",
  "medium.com",
];

/**
 * Website score column names in dlb_website_eval_results.
 * Each column is a JSON object with a "Score" key (capital S).
 */
const WEBSITE_SCORE_FIELDS = [
  "website_overview",
  "brand_expression_and_visual_execution",
  "messaging_and_clarity",
  "ux_navigation",
  "accessibility_and_contrast",
  "ctas_trust_and_conversion",
  "social_consistency_check",
  "risk_and_confidence_framing",
] as const;

/**
 * Brand score column names in dlb_brand_eval_results.
 * Each column is a JSON object with a "score" key (lowercase s).
 */
const BRAND_SCORE_FIELDS = [
  "brand_overview",
  "who_you_are",
  "how_you_look",
  "how_you_sound",
  "who_you_serve",
  "position_and_market_fit",
] as const;


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a Tavily search result entry. */
interface TavilyResult {
  url: string;
  title: string;
  content: string;
}

/** Subset of the Tavily API response we care about. */
interface TavilyResponse {
  results?: TavilyResult[];
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the bare hostname from a URL, stripping www. and lowercasing.
 * Returns the original string lowercased if parsing fails.
 *
 * @param url - Any URL string.
 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./i, "");
  }
}

/**
 * Returns true if the URL belongs to a known social media platform.
 *
 * @param url - URL to test.
 */
function isSocialUrl(url: string): boolean {
  const domain = getDomain(url);
  return SOCIAL_DOMAINS.some((s) => domain === s || domain.endsWith(`.${s}`));
}

// ---------------------------------------------------------------------------
// Score extraction
// ---------------------------------------------------------------------------

/**
 * Safely extracts a numeric score from a database field that may be a JSON
 * string, a JSON object, or null/undefined.
 *
 * @param field - Raw DB column value.
 * @param key   - JSON key to read ("Score" for website rows, "score" for brand rows).
 * @returns The score number, or null if not parseable or zero.
 */
function extractScore(field: unknown, key: string): number | null {
  if (!field) return null;

  let parsed: Record<string, unknown>;

  if (typeof field === "string") {
    try {
      parsed = JSON.parse(field) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof field === "object" && field !== null) {
    parsed = field as Record<string, unknown>;
  } else {
    return null;
  }

  const val = Number(parsed[key]);
  return !isNaN(val) && val > 0 ? val : null;
}

/**
 * Calculates the Enid Score using a section-weighted average:
 *   Brand 40% | Website 35% | Social 25%
 *
 * Brand and website rows are required — call sites should guard against null
 * before calling this. Social defaults to 0 if no rows exist (no social
 * presence is a real gap and should lower the score).
 *
 * @param websiteRow   - Single row from dlb_website_eval_results (required).
 * @param brandRow     - Single row from dlb_brand_eval_results (required).
 * @param socialRows   - All rows from dlb_social_media_agent_results (may be empty).
 */
function calculateEnidScore(
  websiteRow: Record<string, unknown>,
  brandRow: Record<string, unknown>,
  socialRows: Record<string, unknown>[]
): number {
  // Website — average of up to 8 sub-scores
  const websiteScores: number[] = [];
  for (const field of WEBSITE_SCORE_FIELDS) {
    const s = extractScore(websiteRow[field], "Score");
    if (s !== null) websiteScores.push(s);
  }
  const websiteScore =
    websiteScores.length > 0
      ? websiteScores.reduce((a, b) => a + b, 0) / websiteScores.length
      : 0;

  // Brand — average of up to 6 sub-scores
  const brandScores: number[] = [];
  for (const field of BRAND_SCORE_FIELDS) {
    const s = extractScore(brandRow[field], "score");
    if (s !== null) brandScores.push(s);
  }
  const brandScore =
    brandScores.length > 0
      ? brandScores.reduce((a, b) => a + b, 0) / brandScores.length
      : 0;

  // Social — use overall_assessment.overall_score only (avoids double-counting
  // per-platform averages). Defaults to 0 if no social presence was found.
  let socialScore = 0;
  if (socialRows.length > 0) {
    const raw = socialRows[0]["overal_evaluation"];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const overall = Number(
        (parsed as Record<string, Record<string, unknown>>)?.["overall_assessment"]?.["overall_score"]
      );
      if (!isNaN(overall) && overall > 0) socialScore = overall;
    } catch {
      // overall score not parseable — social stays 0
    }
  }

  // Weighted average: Brand 40% | Website 35% | Social 25%
  return Math.round(brandScore * 0.4 + websiteScore * 0.35 + socialScore * 0.25);
}

// ---------------------------------------------------------------------------
// Tavily SEO check
// ---------------------------------------------------------------------------

/**
 * Runs a single Tavily search and returns the result array.
 * Throws with a descriptive message if the request fails.
 *
 * @param query - Natural-language search query.
 */
async function searchTavily(query: string): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed (HTTP ${res.status}) for query: "${query}"`);
  }

  const data = (await res.json()) as TavilyResponse;
  return data.results ?? [];
}

/**
 * Runs two Tavily searches and derives visibility flags:
 *   - websiteVisible: company domain appears in results
 *   - socialVisible: a known social platform appears in results
 *   - pressVisible: a non-company, non-social URL appears in results
 *
 * @param companyName - The company name to search for.
 * @param companyUrl  - The company's primary URL (used to determine its domain).
 */
async function checkSeoVisibility(
  companyName: string,
  companyUrl: string
): Promise<SeoVisibility> {
  const companyDomain = getDomain(companyUrl);

  // Run both searches concurrently
  const [brandResults, reviewResults] = await Promise.all([
    searchTavily(companyName),
    searchTavily(`"${companyName}" review`),
  ]);

  const allUrls = [...brandResults, ...reviewResults].map((r) => r.url);

  const websiteVisible = allUrls.some((u) => getDomain(u) === companyDomain);
  const socialVisible = allUrls.some((u) => isSocialUrl(u));
  const pressVisible = allUrls.some((u) => {
    const d = getDomain(u);
    return d !== companyDomain && !isSocialUrl(u);
  });

  const trueCount = [websiteVisible, socialVisible, pressVisible].filter(Boolean).length;
  const visibilityScore: SeoVisibility["visibilityScore"] =
    trueCount >= 3 ? "Strong" : trueCount === 2 ? "Moderate" : "Weak";

  return { websiteVisible, socialVisible, pressVisible, visibilityScore };
}

// ---------------------------------------------------------------------------
// Claude response parser
// ---------------------------------------------------------------------------

/**
 * Parses the structured JSON snapshot from Claude's raw text response.
 * Falls back to regex extraction if the response is wrapped in markdown fences.
 *
 * @param raw - Raw text from Claude's response.
 */
function parseSnapshotJson(raw: string): SnapshotResult {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed) as SnapshotResult;
  } catch {
    // Try to extract JSON from markdown code fences
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(
        `Snapshot agent returned no parseable JSON: ${trimmed.slice(0, 300)}`
      );
    }
    try {
      return JSON.parse(match[0]) as SnapshotResult;
    } catch {
      throw new Error(
        `Snapshot agent returned invalid JSON: ${match[0].slice(0, 300)}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/** POST /api/snapshot_agent */
export async function POST(req: NextRequest) {
  // Auth: admin session or internal server-to-server secret
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const isInternal =
    internalSecret && req.headers.get("x-internal-secret") === internalSecret;

  if (!isInternal) {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  // Parse body
  let audit_input_id: string;
  try {
    const body = (await req.json()) as { audit_input_id?: string };
    if (!body.audit_input_id) {
      return NextResponse.json(
        { error: "audit_input_id is required." },
        { status: 400 }
      );
    }
    audit_input_id = body.audit_input_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  try {
    // ------------------------------------------------------------------
    // Step 1: Fetch audit input + check for cached snapshot concurrently
    // ------------------------------------------------------------------
    const [inputResult, cachedResult] = await Promise.allSettled([
      supabaseAdmin
        .from("dlb_audit_inputs")
        .select("*")
        .eq("id", audit_input_id)
        .single(),
      supabaseAdmin
        .from("dlb_snapshot_results")
        .select("*")
        .eq("audit_input_id", audit_input_id)
        .single(),
    ]);

    // Audit input is always required
    if (inputResult.status === "rejected" || !inputResult.value.data) {
      return NextResponse.json(
        { error: `Audit input not found for ID: ${audit_input_id}` },
        { status: 404 }
      );
    }

    const auditInput = inputResult.value.data as Record<string, unknown>;
    const companyName = String(auditInput["name"] ?? "Unknown Company");
    const companyUrl = String(auditInput["url"] ?? "");

    // ------------------------------------------------------------------
    // Cache hit: skip Tavily + Claude, go straight to PDF rendering
    // ------------------------------------------------------------------
    const cachedRow =
      cachedResult.status === "fulfilled" && cachedResult.value.data
        ? (cachedResult.value.data as Record<string, unknown>)
        : null;

    let enidScore: number;
    let seoVisibility: SeoVisibility;
    let snapshotResult: SnapshotResult;
    let createdAt: string;

    if (cachedRow) {
      console.log("[snapshot_agent] Cache hit — serving from dlb_snapshot_results");
      enidScore = Number(cachedRow["enid_score"] ?? 0);
      seoVisibility = cachedRow["seo_visibility"] as SeoVisibility;
      snapshotResult = cachedRow["synthesis"] as SnapshotResult;
      createdAt = String(cachedRow["created_at"] ?? new Date().toISOString());
    } else {
      // ----------------------------------------------------------------
      // Cache miss: fetch all audit data and run full pipeline
      // ----------------------------------------------------------------

      // Step 2: Fetch eval results concurrently
      const [websiteResult, brandResult, socialResult, competitorResult] =
        await Promise.allSettled([
          supabaseAdmin
            .from("dlb_website_eval_results")
            .select("*")
            .eq("dlb_audit_inputs_id", audit_input_id)
            .single(),
          supabaseAdmin
            .from("dlb_brand_eval_results")
            .select("*")
            .eq("dlb_audit_input_id", audit_input_id)
            .single(),
          supabaseAdmin
            .from("dlb_social_media_agent_results")
            .select("*")
            .eq("audit_input_id", audit_input_id),
          supabaseAdmin
            .from("dlb_competitor_agent_results")
            .select("*")
            .eq("dlb_audit_inputs_id", audit_input_id),
        ]);

      const websiteRow =
        websiteResult.status === "fulfilled" && websiteResult.value.data
          ? (websiteResult.value.data as Record<string, unknown>)
          : null;
      const brandRow =
        brandResult.status === "fulfilled" && brandResult.value.data
          ? (brandResult.value.data as Record<string, unknown>)
          : null;

      // Brand and website are required — without them there is no snapshot
      if (!websiteRow || !brandRow) {
        return NextResponse.json(
          {
            error:
              !websiteRow && !brandRow
                ? "Website and brand evaluations have not completed yet. Cannot generate snapshot."
                : !websiteRow
                ? "Website evaluation has not completed yet. Cannot generate snapshot."
                : "Brand evaluation has not completed yet. Cannot generate snapshot.",
          },
          { status: 422 }
        );
      }

      const socialRows: Record<string, unknown>[] =
        socialResult.status === "fulfilled" && socialResult.value.data
          ? (socialResult.value.data as Record<string, unknown>[])
          : [];
      const competitorRows: Record<string, unknown>[] =
        competitorResult.status === "fulfilled" && competitorResult.value.data
          ? (competitorResult.value.data as Record<string, unknown>[])
          : [];

      // Step 3: Calculate Enid Score (weighted: Brand 40% | Website 35% | Social 25%)
      enidScore = calculateEnidScore(websiteRow, brandRow, socialRows);

      // Step 4: SEO visibility check via Tavily
      try {
        seoVisibility = await checkSeoVisibility(companyName, companyUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "SEO check failed";
        console.error("[snapshot_agent] SEO check error:", msg);
        seoVisibility = {
          websiteVisible: false,
          socialVisible: false,
          pressVisible: false,
          visibilityScore: "Weak",
        };
      }

      // Step 5: Call Claude snapshot agent
      const socialPayload =
        socialRows.length > 0
          ? socialRows
          : {
              status: "NO_SOCIAL_PRESENCE",
              explanation:
                "The social media agent ran but found no social media profiles for this company. " +
                "This contributed a score of 0 to the 25% social weighting in the Enid Score. " +
                "The snapshot must explicitly tell the client they have no social presence and " +
                "explain why establishing one is critical for brand visibility and trust.",
            };

      const userMessage = JSON.stringify(
        {
          company_info: auditInput,
          website_eval: websiteRow,
          brand_eval: brandRow,
          social_media_results: socialPayload,
          competitor_results:
            competitorRows.length > 0 ? competitorRows : "Not available",
          enid_score: enidScore,
          seo_visibility: seoVisibility,
        },
        null,
        2
      );

      let claudeResponse: Anthropic.Message;
      try {
        claudeResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SNAPSHOT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Claude API call failed";
        throw new Error(`Snapshot agent Claude call failed: ${msg}`);
      }

      const rawText = claudeResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      snapshotResult = parseSnapshotJson(rawText);
      createdAt = new Date().toISOString();

      // Step 6: Save synthesis to cache for future requests
      const { error: saveError } = await supabaseAdmin
        .from("dlb_snapshot_results")
        .insert({
          audit_input_id,
          enid_score: enidScore,
          seo_visibility: seoVisibility,
          synthesis: snapshotResult,
          created_at: createdAt,
        });

      if (saveError) {
        // Non-fatal — log but continue to PDF generation
        console.error("[snapshot_agent] Failed to cache snapshot result:", saveError.message);
      }
    }

    // ------------------------------------------------------------------
    // Step 7: Generate PDF and return as download
    // ------------------------------------------------------------------
    const pdfData: SnapshotPDFData = {
      companyName,
      companyUrl,
      createdAt,
      enidScore,
      seoVisibility,
      snapshot: snapshotResult,
      logoSrc: LOGO_PATH,
    };

    let pdfBytes: Uint8Array;
    try {
      // @react-pdf/renderer v4 toBuffer() can return a Node.js Buffer,
      // a Node.js Readable stream, or a Web ReadableStream depending on the
      // runtime environment. We handle all three cases.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawPdf: unknown = await pdf(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        React.createElement(SnapshotDocument, { data: pdfData }) as any
      ).toBuffer();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = rawPdf as any;

      if (Buffer.isBuffer(raw)) {
        // Node.js Buffer (most common case in Next.js API routes)
        pdfBytes = new Uint8Array(raw);
      } else if (raw instanceof Uint8Array) {
        // Uint8Array (Buffer extends Uint8Array, caught above, but keep as fallback)
        pdfBytes = raw;
      } else if (raw !== null && typeof raw === "object" && typeof raw.getReader === "function") {
        // Web ReadableStream<Uint8Array>
        const stream = raw as ReadableStream<Uint8Array>;
        const chunks: Uint8Array[] = [];
        const reader = stream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        pdfBytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          pdfBytes.set(chunk, offset);
          offset += chunk.length;
        }
      } else if (raw !== null && typeof raw === "object" && typeof raw.on === "function") {
        // Node.js Readable stream (EventEmitter style)
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          raw.on("data", (chunk: any) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          raw.on("end", resolve);
          raw.on("error", reject);
        });
        const combined = Buffer.concat(chunks);
        pdfBytes = new Uint8Array(combined);
      } else {
        throw new Error(
          `pdf().toBuffer() returned unrecognised type: ${typeof raw}` +
          (raw !== null && typeof raw === "object"
            ? `, keys: ${Object.keys(raw).slice(0, 10).join(", ")}`
            : "")
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PDF generation failed";
      throw new Error(`Snapshot PDF generation failed: ${msg}`);
    }

    const safeName = companyName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    // Use standard Response (not NextResponse) — Next.js accepts both from
    // route handlers. NextResponse's BodyInit types are narrower and reject
    // Uint8Array despite it being valid at runtime.
    return new Response(pdfBytes.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="enid-snapshot-${safeName}.pdf"`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Snapshot generation failed.";
    console.error("[snapshot_agent] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/snapshot_agent — reset cached snapshot
// ---------------------------------------------------------------------------

/**
 * Deletes the cached snapshot row for the given audit so the next POST
 * triggers a full regeneration (Tavily + Claude).
 *
 * Body: { audit_input_id: string }
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let audit_input_id: string;
  try {
    const body = (await req.json()) as { audit_input_id?: string };
    if (!body.audit_input_id) {
      return NextResponse.json(
        { error: "audit_input_id is required." },
        { status: 400 }
      );
    }
    audit_input_id = body.audit_input_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabaseAdmin
    .from("dlb_snapshot_results")
    .delete()
    .eq("audit_input_id", audit_input_id);

  if (error) {
    console.error("[snapshot_agent] Failed to delete cached snapshot:", error.message);
    return NextResponse.json(
      { error: `Failed to reset snapshot: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
