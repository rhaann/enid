/**
 * @file route.ts
 * POST /api/social_media_agent
 *
 * Social Media Agent — discovers social profiles, audits each platform with Claude,
 * then runs a cross-platform synthesis to produce a complete social media report.
 *
 * Flow:
 *  1. Auth check (internal secret OR admin session)
 *  2. Create workflow_runs row: "social-media-agent"
 *  3. Fetch dlb_audit_inputs row
 *  4. Verify evaluator results exist (dlb_brand_eval_results or dlb_website_eval_results)
 *  5. Fetch scraped HTML from dlb_audit_scraped_websites
 *  6. Run URL Filter agent — returns [{ platform, url }]
 *  7. Crawl each profile URL with Tavily (parallel)
 *  8. Run auditSocialPlatform() for each platform (parallel)
 *  9. Save each result to dlb_social_media_results
 * 10. Run Cross-Platform Evaluation agent
 * 11. Save overall result to dlb_social_media_overall_results
 * 12. Mark workflow_runs + dlb_audit_inputs as Done
 *
 * Auth: accepts an admin browser session OR an x-internal-secret header.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/supabase/auth";
import {
  type Platform,
  URL_FILTER_SYSTEM_PROMPT,
  PLATFORM_PROMPTS,
  CROSS_PLATFORM_SYSTEM_PROMPT,
} from "./prompts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A discovered social media profile URL with its platform label. */
interface SocialProfile {
  platform: Platform;
  url: string;
}

/** A { score, assessment } pair for a single audit category. */
interface CategoryScore {
  score: number;
  assessment: string;
}

/** Structured result returned by auditSocialPlatform(). */
interface SocialPlatformResult {
  platform_type: string;
  social_media_url: string;
  profile_completeness: CategoryScore;
  content_quality: CategoryScore;
  brand_alignment: CategoryScore;
  audience_engagement: CategoryScore;
  posting_frequency: CategoryScore;
  visual_consistency: CategoryScore;
  platform_average: number;
  strengths: string[];
  issues: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ---------------------------------------------------------------------------
// Workflow helpers
// ---------------------------------------------------------------------------

/**
 * Creates a new workflow_runs row in "In Progress" state.
 *
 * @param auditInputId - The dlb_audit_inputs.id this workflow belongs to.
 * @returns The newly created workflow_runs row ID.
 */
async function createWorkflowRun(auditInputId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("workflow_runs")
    .insert({
      audit_input_id: auditInputId,
      workflow_name: "social-media-agent",
      status: "In Progress",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create workflow run: ${error?.message ?? "No data returned"}`
    );
  }
  return data.id as string;
}

/**
 * Marks a workflow_runs row as Done or Failed.
 *
 * @param workflowRunId - The workflow_runs.id to update.
 * @param failed        - True to mark as Failed, false for Done.
 * @param errorMsg      - Optional error message to store on failure.
 */
async function completeWorkflowRun(
  workflowRunId: string,
  failed = false,
  errorMsg?: string
): Promise<void> {
  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status: failed ? "Failed" : "Done",
      completed_at: new Date().toISOString(),
      ...(errorMsg ? { error_message: errorMsg } : {}),
    })
    .eq("id", workflowRunId);
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/**
 * Parses a raw JSON string from a Claude response, falling back to regex
 * extraction if the model wrapped it in markdown fences.
 *
 * @param raw       - Raw text from Claude.
 * @param agentName - Identifier used in error messages.
 */
function parseJsonResponse(raw: string, agentName: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`${agentName} returned no JSON: ${trimmed.slice(0, 300)}`);
    }
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      throw new Error(
        `${agentName} returned unparseable JSON: ${match[0].slice(0, 300)}`
      );
    }
  }
}

/**
 * Parses and validates a platform audit JSON result from Claude.
 * Returns a safe fallback structure if parsing fails.
 *
 * @param raw      - Raw text from Claude.
 * @param platform - The platform being audited (used in error messages).
 * @param url      - The profile URL (used as fallback social_media_url).
 */
function parsePlatformJson(
  raw: string,
  platform: Platform,
  url: string
): SocialPlatformResult {
  let parsed: Record<string, unknown>;
  try {
    parsed = parseJsonResponse(raw, `${platform} audit agent`);
  } catch {
    // Return a minimal failed-parse result rather than crashing the whole run
    return {
      platform_type: platform,
      social_media_url: url,
      profile_completeness: { score: 0, assessment: "Could not parse audit result." },
      content_quality: { score: 0, assessment: "" },
      brand_alignment: { score: 0, assessment: "" },
      audience_engagement: { score: 0, assessment: "" },
      posting_frequency: { score: 0, assessment: "" },
      visual_consistency: { score: 0, assessment: "" },
      platform_average: 0,
      strengths: [],
      issues: ["Audit result could not be parsed."],
      recommendations: [],
    };
  }

  const cat = (key: string): CategoryScore => {
    const v = parsed[key];
    if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      return {
        score: Number(obj.score) || 0,
        assessment: String(obj.assessment ?? ""),
      };
    }
    return { score: 0, assessment: "" };
  };

  const arr = (key: string): string[] => {
    const v = parsed[key];
    if (Array.isArray(v)) return v.map(String);
    return [];
  };

  return {
    platform_type: String(parsed.platform_type ?? platform),
    social_media_url: String(parsed.social_media_url ?? url),
    profile_completeness: cat("profile_completeness"),
    content_quality: cat("content_quality"),
    brand_alignment: cat("brand_alignment"),
    audience_engagement: cat("audience_engagement"),
    posting_frequency: cat("posting_frequency"),
    visual_consistency: cat("visual_consistency"),
    platform_average: Number(parsed.platform_average) || 0,
    strengths: arr("strengths"),
    issues: arr("issues"),
    recommendations: arr("recommendations"),
  };
}

// ---------------------------------------------------------------------------
// Tavily crawl
// ---------------------------------------------------------------------------

/**
 * Crawls a social media profile URL using Tavily search and returns
 * a formatted string of the page content for Claude to analyse.
 *
 * @param url - The social media profile URL to crawl.
 * @returns Formatted content string, or "Profile could not be crawled" on failure.
 */
async function crawlWithTavily(url: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query: url,
      search_depth: "advanced",
      max_results: 5,
      include_answer: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily crawl failed (${res.status}) for ${url}`);
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title: string; content: string; url: string }>;
  };

  const snippets = (data.results ?? [])
    .map((r) => `[${r.title}](${r.url})\n${r.content}`)
    .join("\n\n");

  return data.answer
    ? `Summary: ${data.answer}\n\nSources:\n${snippets}`
    : snippets || "Profile could not be crawled";
}

// ---------------------------------------------------------------------------
// Platform audit
// ---------------------------------------------------------------------------

/**
 * Audits a single social media platform profile using Claude.
 *
 * Selects the correct system prompt based on platform, passes the crawled
 * content as the user message, and returns a typed SocialPlatformResult.
 *
 * @param platform       - The platform being audited.
 * @param url            - The profile URL.
 * @param crawledContent - Content returned by crawlWithTavily().
 * @param auditInputId   - The parent audit ID (used for logging context).
 */
async function auditSocialPlatform(
  platform: Platform,
  url: string,
  crawledContent: string,
  auditInputId: string
): Promise<SocialPlatformResult> {
  const systemPrompt = PLATFORM_PROMPTS[platform];

  const userMessage = [
    `Platform URL: ${url}`,
    `Audit Input ID: ${auditInputId}`,
    "",
    "Crawled profile content:",
    crawledContent.slice(0, 40_000) || "Profile could not be crawled",
  ].join("\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`${platform} audit agent returned a non-text response block`);
  }

  return parsePlatformJson(block.text, platform, url);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Accept an admin browser session OR a server-to-server internal secret.
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternalCall =
    internalSecret &&
    process.env.INTERNAL_API_SECRET &&
    internalSecret === process.env.INTERNAL_API_SECRET;

  if (!isInternalCall) {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  let workflowRunId: string | null = null;
  let auditInputId: string | null = null;

  try {
    // ------------------------------------------------------------------
    // 1. Parse request body
    // ------------------------------------------------------------------
    const body = await req.json().catch(() => null);
    const { audit_input_id } = (body ?? {}) as { audit_input_id?: string };

    if (!audit_input_id) {
      return NextResponse.json(
        { error: "audit_input_id is required." },
        { status: 400 }
      );
    }
    auditInputId = audit_input_id;

    // ------------------------------------------------------------------
    // 2. Create workflow_runs row
    // ------------------------------------------------------------------
    workflowRunId = await createWorkflowRun(audit_input_id);

    // ------------------------------------------------------------------
    // 3. Fetch audit input row
    // ------------------------------------------------------------------
    const { data: auditInput, error: auditError } = await supabaseAdmin
      .from("dlb_audit_inputs")
      .select("*")
      .eq("id", audit_input_id)
      .single();

    if (auditError || !auditInput) {
      throw new Error(
        `Audit input ${audit_input_id} not found: ${auditError?.message ?? "Not found"}`
      );
    }

    // ------------------------------------------------------------------
    // 4. Verify evaluator agent completed
    // ------------------------------------------------------------------
    const [{ data: brandEval }, { data: websiteEval }] = await Promise.all([
      supabaseAdmin
        .from("dlb_brand_eval_results")
        .select("*")
        .eq("dlb_audit_input_id", audit_input_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("dlb_website_eval_results")
        .select("id")
        .eq("dlb_audit_inputs_id", audit_input_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!brandEval && !websiteEval) {
      const errMsg = "Evaluator agent results not found";
      await completeWorkflowRun(workflowRunId, true, errMsg);
      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    // ------------------------------------------------------------------
    // 5. Fetch scraped HTML from dlb_audit_scraped_websites
    // ------------------------------------------------------------------
    const { data: scrapedPages } = await supabaseAdmin
      .from("dlb_audit_scraped_websites")
      .select("html, specific_url")
      .eq("dlb_audit_inputs_id", audit_input_id);

    const MAX_HTML_CHARS = 200_000;
    let combinedHtml = (scrapedPages ?? [])
      .map((p: { html: string; specific_url: string }) =>
        `\n\n--- Page: ${p.specific_url} ---\n${p.html ?? ""}`
      )
      .join("");
    if (combinedHtml.length > MAX_HTML_CHARS) {
      combinedHtml = combinedHtml.slice(0, MAX_HTML_CHARS) + "\n[truncated]";
    }

    // ------------------------------------------------------------------
    // 6. Regex extraction — fast, deterministic, no Claude needed.
    //    Pulls full social profile URLs directly from the scraped HTML.
    //    This handles brands like DLB where the links are clearly in the
    //    markup but Claude's URL filter sometimes misses them in dense HTML.
    // ------------------------------------------------------------------
    const REGEX_SOCIAL_PATTERNS: Array<{ platform: Platform; re: RegExp }> = [
      { platform: "LinkedIn",  re: /https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[^\s"'></?#]+/gi },
      { platform: "Instagram", re: /https?:\/\/(www\.)?instagram\.com\/[^\s"'></?#]+/gi },
      { platform: "Twitter/X", re: /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s"'></?#]+/gi },
      { platform: "Facebook",  re: /https?:\/\/(www\.)?facebook\.com\/[^\s"'></?#]+/gi },
      { platform: "YouTube",   re: /https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|@)[^\s"'></?#]+/gi },
      { platform: "TikTok",    re: /https?:\/\/(www\.)?tiktok\.com\/@[^\s"'></?#]+/gi },
      { platform: "Pinterest", re: /https?:\/\/(www\.)?pinterest\.com\/[^\s"'></?#]+/gi },
    ];

    let profiles: SocialProfile[] = [];

    // Add any user-provided URLs first
    const userProvidedMap: Partial<Record<Platform, string>> = {
      LinkedIn:   auditInput.linkedin_url  || undefined,
      "Twitter/X": auditInput.x_url        || undefined,
      Facebook:   auditInput.facebook_url  || undefined,
      Instagram:  auditInput.instagram_url || undefined,
      YouTube:    auditInput.youtube_url   || undefined,
      TikTok:     auditInput.tiktok_url    || undefined,
      Pinterest:  auditInput.pinterest_url || undefined,
    };
    for (const [platform, url] of Object.entries(userProvidedMap)) {
      if (url) profiles.push({ platform: platform as Platform, url });
    }

    // Regex-extract from HTML for any platform not already provided
    const seenPlatformsRegex = new Set(profiles.map((p) => p.platform));
    for (const { platform, re } of REGEX_SOCIAL_PATTERNS) {
      if (seenPlatformsRegex.has(platform)) continue;
      const matches = [...new Set(combinedHtml.match(re) ?? [])];
      const profileMatch = matches.find((url) => {
        const path = url.replace(/^https?:\/\/(www\.)?[^/]+/i, "");
        return path.length > 1; // exclude bare domain roots
      });
      if (profileMatch) {
        profiles.push({ platform, url: profileMatch });
        seenPlatformsRegex.add(platform);
      }
    }

    console.log(`[social_media_agent] Regex extraction found ${profiles.length} profiles:`, profiles.map((p) => `${p.platform}: ${p.url}`));

    // Derive brand slug once — used in both Tavily search and slug construction.
    const brandSlug = (() => {
      try {
        return new URL(String(auditInput.url ?? ""))
          .hostname
          .replace(/^www\./, "")
          .split(".")[0]
          .toLowerCase();
      } catch { return ""; }
    })();

    console.log(`[social_media_agent] Brand slug: "${brandSlug}"`);

    // ------------------------------------------------------------------
    // 6b. Tavily web search — finds the brand's ACTUAL social handles.
    //     Searches broadly (no include_domains) so results include press
    //     releases, directories, and the brand's own site — all of which
    //     mention their real social profile URLs. Works for any brand,
    //     not just well-known ones where the handle matches the domain.
    // ------------------------------------------------------------------
    const SOCIAL_EXTRACT_RE: Array<{ re: RegExp; platform: Platform }> = [
      { re: /https?:\/\/(www\.)?linkedin\.com\/company\/[^\s"'></?#]+/gi, platform: "LinkedIn"  },
      { re: /https?:\/\/(www\.)?instagram\.com\/[^\s"'></?#]+/gi,         platform: "Instagram" },
      { re: /https?:\/\/(www\.)?(twitter|x)\.com\/[^\s"'></?#]+/gi,       platform: "Twitter/X" },
      { re: /https?:\/\/(www\.)?facebook\.com\/[^\s"'></?#]+/gi,          platform: "Facebook"  },
      { re: /https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|@)[^\s"'></?#]+/gi, platform: "YouTube" },
      { re: /https?:\/\/(www\.)?tiktok\.com\/@[^\s"'></?#]+/gi,           platform: "TikTok"   },
      { re: /https?:\/\/(www\.)?pinterest\.com\/[^\s"'></?#]+/gi,         platform: "Pinterest" },
    ];
    const CONTENT_PATH_RE = /\/(reel|p|tv|stories|posts?|photo|video|watch|shorts|playlist|status|pin)\b/i;

    try {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: `${auditInput.name} official social media LinkedIn Instagram`,
          search_depth: "basic",
          max_results: 10,
          // No include_domains — broad search finds any page mentioning the brand's handles
        }),
      });

      if (tavilyRes.ok) {
        const tavilyData = await tavilyRes.json() as { results?: { url: string; content: string }[] };
        // Combine all result URLs + snippet text — social profile URLs appear in both
        const allText = (tavilyData.results ?? [])
          .map((r) => `${r.url} ${r.content}`)
          .join("\n");

        console.log(`[social_media_agent] Tavily broad search returned ${tavilyData.results?.length ?? 0} results`);

        const alreadyFound = new Set(profiles.map((p) => p.platform));
        for (const { re, platform } of SOCIAL_EXTRACT_RE) {
          if (alreadyFound.has(platform)) continue;
          re.lastIndex = 0;
          const matches = [...new Set(allText.match(re) ?? [])];
          const profileMatch = matches.find((url) => {
            if (CONTENT_PATH_RE.test(url)) return false;
            const path = url.replace(/^https?:\/\/(www\.)?[^/]+/i, "");
            return path.length > 1;
          });
          if (profileMatch) {
            profiles.push({ platform, url: profileMatch });
            alreadyFound.add(platform);
          }
        }
        console.log(`[social_media_agent] After Tavily search: ${profiles.length} profiles:`, profiles.map((p) => `${p.platform}: ${p.url}`));
      }
    } catch (e) {
      console.warn("[social_media_agent] Tavily broad search failed:", e instanceof Error ? e.message : String(e));
    }

    // ------------------------------------------------------------------
    // 6c. Slug construction — last resort for any platform still missing.
    //     Constructs canonical URLs from the domain slug (nike.com → nike).
    //     Works reliably for Nike-sized brands. For smaller brands with
    //     different handles, the Tavily crawl step will surface low content
    //     and scores will naturally reflect a weak/missing presence.
    // ------------------------------------------------------------------
    if (brandSlug) {
      const alreadyFound = new Set(profiles.map((p) => p.platform));
      const SLUG_CANDIDATES: Array<{ platform: Platform; url: string }> = [
        { platform: "LinkedIn",  url: `https://www.linkedin.com/company/${brandSlug}/` },
        { platform: "Instagram", url: `https://www.instagram.com/${brandSlug}/` },
        { platform: "Twitter/X", url: `https://x.com/${brandSlug}` },
        { platform: "Facebook",  url: `https://www.facebook.com/${brandSlug}` },
        { platform: "YouTube",   url: `https://www.youtube.com/@${brandSlug}` },
        { platform: "TikTok",    url: `https://www.tiktok.com/@${brandSlug}` },
      ];
      for (const candidate of SLUG_CANDIDATES) {
        if (!alreadyFound.has(candidate.platform)) {
          profiles.push(candidate);
          alreadyFound.add(candidate.platform);
        }
      }
      console.log(`[social_media_agent] After slug construction: ${profiles.length} profiles:`, profiles.map((p) => `${p.platform}: ${p.url}`));
    }

    // ------------------------------------------------------------------
    // 8. Guard: no social profiles found after fallback
    // ------------------------------------------------------------------
    if (profiles.length === 0) {
      const errMsg = "No social media profiles found";
      await completeWorkflowRun(workflowRunId, true, errMsg);
      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    // ------------------------------------------------------------------
    // 9. Crawl each profile URL with Tavily (parallel, non-fatal failures)
    // ------------------------------------------------------------------
    const crawledProfiles = await Promise.all(
      profiles.map(async (profile) => {
        let content: string;
        try {
          content = await crawlWithTavily(profile.url);
        } catch (e) {
          console.warn(
            `[social_media_agent] Tavily crawl failed for ${profile.url}: ${
              e instanceof Error ? e.message : String(e)
            }`
          );
          content = "Profile could not be crawled";
        }
        return { ...profile, crawledContent: content };
      })
    );

    // ------------------------------------------------------------------
    // 9. Audit each platform in parallel
    // ------------------------------------------------------------------
    const platformResults = await Promise.all(
      crawledProfiles.map((p) =>
        auditSocialPlatform(p.platform, p.url, p.crawledContent, audit_input_id)
      )
    );

    // ------------------------------------------------------------------
    // 10. Run Cross-Platform Evaluation agent
    // ------------------------------------------------------------------
    const crossPlatformMessage = [
      "Brand Evaluation Context:",
      JSON.stringify(brandEval ?? {}),
      "",
      "Individual Platform Audit Results:",
      ...platformResults.map(
        (r) => `\n--- ${r.platform_type} (${r.social_media_url}) ---\n${JSON.stringify(r)}`
      ),
    ].join("\n");

    const crossResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: [
        {
          type: "text",
          text: CROSS_PLATFORM_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: crossPlatformMessage }],
    });

    const crossBlock = crossResponse.content[0];
    if (crossBlock.type !== "text") {
      throw new Error("Cross-Platform Evaluation agent returned a non-text response block");
    }

    const crossResult = parseJsonResponse(
      crossBlock.text,
      "Cross-Platform Evaluation Agent"
    );

    // Serialise the full cross-platform JSON as overal_evaluation text so the
    // existing mapWebhookToAudit parser can extract structured fields from it.
    const overalEvaluationText = JSON.stringify(crossResult);

    // ------------------------------------------------------------------
    // 11. Save each platform result to dlb_social_media_agent_results
    // ------------------------------------------------------------------
    const companyName = (auditInput.name as string) ?? "";

    for (const result of platformResults) {
      const { error: insertError } = await supabaseAdmin
        .from("dlb_social_media_agent_results")
        .insert({
          audit_input_id,
          company_name: companyName,
          platform_type: result.platform_type,
          social_media_url: result.social_media_url,
          profile_completeness: result.profile_completeness,
          content_quality: result.content_quality,
          brand_alignment: result.brand_alignment,
          audience_engagement: result.audience_engagement,
          posting_frequency: result.posting_frequency,
          visual_consistency: result.visual_consistency,
          platform_average: result.platform_average,
          strengths: result.strengths,
          weaknesses: result.issues,
          recommendations: result.recommendations,
          overal_evaluation: overalEvaluationText,
        });

      if (insertError) {
        throw new Error(
          `Failed to save ${result.platform_type} result: ${insertError.message}`
        );
      }
    }

    // ------------------------------------------------------------------
    // 13. Mark Done (workflow_runs only — dlb_audit_inputs.status is owned
    //     by the evaluator agent and must not be overwritten here)
    // ------------------------------------------------------------------
    await completeWorkflowRun(workflowRunId);

    return NextResponse.json({
      success: true,
      platforms_audited: platformResults.length,
    });
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "An unknown error occurred";
    console.error("[social_media_agent]", errorMessage);

    // Only update workflow_runs — do not touch dlb_audit_inputs.status, which
    // is owned by the evaluator agent.
    if (workflowRunId) {
      await completeWorkflowRun(workflowRunId, true, errorMessage);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
