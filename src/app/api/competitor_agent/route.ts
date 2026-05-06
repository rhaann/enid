/**
 * @file route.ts
 * POST /api/competitor_agent
 *
 * Competitor Agent — discovers, scrapes, and analyses up to 6 competitors for a
 * given audit. Uses EXA to discover competitors when the client hasn't provided
 * enough, Firecrawl to scrape their websites, and Claude (with Tavily tool use)
 * to produce a structured competitive profile for each one.
 *
 * Auth: accepts an admin browser session OR an x-internal-secret header so it
 * can be called server-to-server from other API routes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import FirecrawlApp from "@mendable/firecrawl-js";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/supabase/auth";
import { ANALYZE_COMPETITOR_SYSTEM_PROMPT } from "./prompts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single competitor URL with its classified type. */
interface CompetitorTarget {
  url: string;
  competitor_type: "local" | "national" | "global";
}

/** The structured profile returned by the Analyze Competitor agent. */
interface CompetitorResult {
  company_name: string;
  company_url: string;
  size: string;
  location: string;
  competitor_type: string;
  social_links: string[];
  advantage: string;
  disadvantage: string;
  leadership: { title: string; name: string }[];
  established_date: string;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ---------------------------------------------------------------------------
// Tavily tool definition for Claude
// ---------------------------------------------------------------------------

/** Tool definition that gives Claude access to Tavily web search. */
const TAVILY_TOOL: Anthropic.Messages.Tool = {
  name: "web_search",
  description:
    "Search the web to find missing information about a company such as its headquarters location, founding year, or leadership team.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The search query, e.g. 'Acme Corp headquarters location' or 'Acme Corp CEO founded year'.",
      },
    },
    required: ["query"],
  },
};

// ---------------------------------------------------------------------------
// URL / domain helpers
// ---------------------------------------------------------------------------

/**
 * Normalises a URL to its bare hostname for deduplication.
 * Strips www., lowercases, and ignores path/query.
 */
function normalizeDomain(url: string): string {
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./i, "").replace(/^https?:\/\//i, "");
  }
}

/**
 * Parses the `competitor_urls` field from `dlb_audit_inputs`.
 * The DB column may be a PostgreSQL text array OR a comma-separated string.
 */
function parseCompetitorUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as unknown[])
      .map((u) => String(u).trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Deduplicates and limits a competitor target list.
 * Always excludes the client's own domain so it never appears as a competitor.
 *
 * @param targets    - Full (possibly duplicate) list of competitor targets.
 * @param ownDomain  - The client company's domain to exclude.
 * @param limit      - Maximum number of targets to return (default 6).
 */
function dedupeAndLimit(
  targets: CompetitorTarget[],
  ownDomain: string,
  limit = 6
): CompetitorTarget[] {
  const seen = new Set<string>();
  seen.add(normalizeDomain(ownDomain));

  const result: CompetitorTarget[] = [];
  for (const t of targets) {
    const domain = normalizeDomain(t.url);
    if (!seen.has(domain)) {
      seen.add(domain);
      result.push(t);
    }
    if (result.length >= limit) break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// EXA search helper
// ---------------------------------------------------------------------------

/** EXA search result shape (subset of the full response). */
interface ExaResult {
  url: string;
  title?: string;
}

/**
 * Searches EXA for competitor websites.
 *
 * @param query      - Natural-language search query.
 * @param numResults - How many URLs to request from EXA.
 * @returns Array of discovered URLs (may be shorter than numResults).
 */
async function searchExa(query: string, numResults: number): Promise<string[]> {
  if (numResults <= 0) return [];

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.EXA_API_KEY!,
    },
    body: JSON.stringify({ query, numResults, type: "auto" }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`EXA search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { results?: ExaResult[] };
  return (data.results ?? []).map((r) => r.url).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Tavily helper (called by Claude's tool use loop)
// ---------------------------------------------------------------------------

/**
 * Calls the Tavily search API and returns a formatted string summary
 * suitable for returning to Claude as a tool result.
 *
 * @param query - The search query string.
 */
async function callTavily(query: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: "basic",
      max_results: 3,
      include_answer: true,
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily API error (${res.status})`);
  }

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title: string; content: string }>;
  };

  const snippets = (data.results ?? [])
    .slice(0, 3)
    .map((r) => `${r.title}: ${r.content}`)
    .join("\n\n");

  return data.answer
    ? `Answer: ${data.answer}\n\nSources:\n${snippets}`
    : snippets || "No results found.";
}

// ---------------------------------------------------------------------------
// JSON parser
// ---------------------------------------------------------------------------

/**
 * Parses a competitor JSON response from Claude.
 * Falls back to regex extraction if the response is wrapped in markdown fences.
 *
 * @param raw - Raw text from Claude's response.
 * @param url - The competitor URL being analysed (used in error messages).
 */
function parseCompetitorJson(raw: string, url: string): CompetitorResult {
  const trimmed = raw.trim();
  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(
        `Competitor analysis for ${url} returned no JSON: ${trimmed.slice(0, 200)}`
      );
    }
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new Error(
        `Competitor analysis for ${url} returned invalid JSON: ${match[0].slice(0, 200)}`
      );
    }
  }

  const r = parsed as Record<string, unknown>;
  return {
    company_name: (r.company_name as string) ?? "Unknown",
    company_url: (r.company_url as string) ?? url,
    size: (r.size as string) ?? "Unknown",
    location: (r.location as string) ?? "Unknown",
    competitor_type: (r.competitor_type as string) ?? "national",
    social_links: Array.isArray(r.social_links) ? (r.social_links as string[]) : [],
    advantage: (r.advantage as string) ?? "",
    disadvantage: (r.disadvantage as string) ?? "",
    leadership: Array.isArray(r.leadership)
      ? (r.leadership as { title: string; name: string }[])
      : [],
    established_date: (r.established_date as string) ?? "Unknown",
  };
}

// ---------------------------------------------------------------------------
// Analyze Competitor — multi-turn Claude agent with Tavily tool use
// ---------------------------------------------------------------------------

/**
 * Sends a single competitor to Claude for analysis.
 * Claude may call the `web_search` (Tavily) tool up to once per missing field
 * before returning a final JSON profile.
 *
 * @param url             - Competitor website URL.
 * @param competitor_type - Classification assigned during discovery.
 * @param scraped_html    - Raw HTML from Firecrawl, or the fallback message.
 */
async function analyzeCompetitor(
  url: string,
  competitor_type: "local" | "national" | "global",
  scraped_html: string,
  clientLocation: string
): Promise<CompetitorResult> {
  const userContent = [
    `URL: ${url}`,
    `Initial Competitor Type: ${competitor_type}`,
    `Client Location: ${clientLocation}`,
    "",
    "Scraped HTML (truncated to 40,000 chars):",
    scraped_html.slice(0, 40_000) || "Website could not be scraped",
  ].join("\n");

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userContent },
  ];

  // Allow up to 12 turns to accommodate per-field Tavily lookups
  // (3 missing fields × 1 search each + a few buffer turns).
  const MAX_TURNS = 12;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: ANALYZE_COMPETITOR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [TAVILY_TOOL],
      tool_choice: { type: "auto" },
      messages,
    });

    // Add the assistant turn to the conversation history.
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "tool_use") {
      // Claude wants to call Tavily — execute every tool_use block in parallel.
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      const toolResults: Anthropic.Messages.ToolResultBlockParam[] =
        await Promise.all(
          toolUseBlocks.map(async (toolUse) => {
            let content: string;
            try {
              if (toolUse.name === "web_search") {
                const { query } = toolUse.input as { query: string };
                content = await callTavily(query);
              } else {
                content = `Unknown tool: ${toolUse.name}`;
              }
            } catch (e) {
              content = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
            }
            return {
              type: "tool_result" as const,
              tool_use_id: toolUse.id,
              content,
            };
          })
        );

      messages.push({ role: "user", content: toolResults });
      continue;
    }

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      );
      if (!textBlock) {
        throw new Error(`No text response from competitor analysis for ${url}`);
      }
      return parseCompetitorJson(textBlock.text, url);
    }

    throw new Error(
      `Unexpected stop_reason "${response.stop_reason}" analysing competitor ${url}`
    );
  }

  throw new Error(
    `Competitor analysis for ${url} exceeded ${MAX_TURNS} tool-use turns`
  );
}

// ---------------------------------------------------------------------------
// EXA query builder
// ---------------------------------------------------------------------------

/**
 * Builds a natural-language EXA search query from the audit input and brand
 * overview assessment. Keeps each part short to stay within EXA's query limits.
 *
 * @param auditInput     - Raw dlb_audit_inputs row.
 * @param brandAssessment - Text from dlb_brand_eval_results.brand_overview.assessment.
 */
function buildExaQuery(
  auditInput: Record<string, unknown>,
  brandAssessment?: string
): string {
  const parts: string[] = [
    `Competitors of ${(auditInput.name as string) ?? "this company"}`,
  ];
  if (auditInput.industry) parts.push(`a ${auditInput.industry} company`);
  if (brandAssessment) parts.push(brandAssessment.slice(0, 200));
  if (auditInput.business_goals) {
    parts.push(String(auditInput.business_goals).slice(0, 200));
  }
  return parts.join(". ");
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
    const { data: wfRow, error: wfError } = await supabaseAdmin
      .from("workflow_runs")
      .insert({
        audit_input_id,
        workflow_name: "competitor-agent",
        status: "In Progress",
      })
      .select("id")
      .single();

    if (wfError || !wfRow) {
      throw new Error(
        `Failed to create workflow run: ${wfError?.message ?? "No data returned"}`
      );
    }
    workflowRunId = wfRow.id as string;

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
    // 4. Fetch most recent evaluator results (both in parallel)
    // ------------------------------------------------------------------
    const [{ data: brandEval }, { data: websiteEval }] = await Promise.all([
      supabaseAdmin
        .from("dlb_brand_eval_results")
        .select("brand_overview")
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
      await supabaseAdmin
        .from("workflow_runs")
        .update({
          status: "Failed",
          error_message: errMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", workflowRunId);
      return NextResponse.json({ error: errMsg }, { status: 422 });
    }

    // ------------------------------------------------------------------
    // 5. Build EXA search query
    // ------------------------------------------------------------------
    const brandOverview = brandEval?.brand_overview as
      | { assessment?: string }
      | null;
    const exaQuery = buildExaQuery(
      auditInput as Record<string, unknown>,
      brandOverview?.assessment
    );

    // ------------------------------------------------------------------
    // 6. Determine competitor target list — pure TypeScript, no LLM
    // ------------------------------------------------------------------
    const confirmedUrls = parseCompetitorUrls(auditInput.competitor_urls);
    const ownDomain = normalizeDomain((auditInput.url as string) ?? "");
    // Prefer the explicit location field; fall back to target_location for old records
    const clientLocation = (auditInput.location as string) || (auditInput.target_location as string) || "";
    // City = everything before the first comma (e.g. "Nashville" from "Nashville, TN, USA")
    const clientCity = clientLocation.includes(",")
      ? clientLocation.split(",")[0].trim()
      : clientLocation;

    let targets: CompetitorTarget[] = [];

    if (confirmedUrls.length >= 6) {
      // Case A: client provided 6+ URLs — use first 6, skip EXA entirely.
      // Claude will determine the correct type based on actual location.
      targets = confirmedUrls
        .slice(0, 6)
        .map((url) => ({ url, competitor_type: "national" as const }));
    } else if (confirmedUrls.length >= 1) {
      // Case B: 1–5 confirmed URLs — top up with EXA.
      const needed = 6 - confirmedUrls.length;
      const localCount = Math.floor(needed / 3);
      const nationalCount = Math.floor(needed / 3);
      const globalCount = needed - localCount - nationalCount;

      // Run only the searches that are non-zero.
      type SearchEntry = { type: "local" | "national" | "global"; count: number; suffix: string };
      const searchPlan: SearchEntry[] = [
        { type: "local", count: localCount, suffix: `competitor based in ${clientCity || "same city"}` },
        { type: "national", count: nationalCount, suffix: "competitor in same country" },
        { type: "global", count: globalCount, suffix: "international competitor" },
      ].filter((s) => s.count > 0);

      const exaResults = await Promise.all(
        searchPlan.map((s) => searchExa(`${exaQuery} ${s.suffix}`, s.count))
      );

      targets = [
        ...confirmedUrls.map((url) => ({
          url,
          competitor_type: "national" as const,
        })),
        ...exaResults.flatMap((urls, i) =>
          urls.map((url) => ({
            url,
            competitor_type: searchPlan[i].type,
          }))
        ),
      ];
    } else {
      // Case C: no confirmed URLs — run 3 parallel EXA searches (4 each so
      // we have buffer after deduplication, aiming for 2 per type).
      const cityStr = clientCity || "worldwide";
      const [localUrls, nationalUrls, globalUrls] = await Promise.all([
        searchExa(`${exaQuery} competitor based in ${cityStr}`, 4),
        searchExa(`${exaQuery} competitor in same country different city`, 4),
        searchExa(`${exaQuery} international competitor`, 4),
      ]);

      targets = [
        ...localUrls.map((url) => ({ url, competitor_type: "local" as const })),
        ...nationalUrls.map((url) => ({
          url,
          competitor_type: "national" as const,
        })),
        ...globalUrls.map((url) => ({
          url,
          competitor_type: "global" as const,
        })),
      ];
    }

    // Dedupe by domain and drop the client's own domain.
    targets = dedupeAndLimit(targets, ownDomain, 6);

    if (targets.length === 0) {
      throw new Error(
        "No competitors could be identified. Check competitor_urls or EXA results."
      );
    }

    // ------------------------------------------------------------------
    // 7. Scrape each competitor URL with Firecrawl (parallel)
    //    Failures are non-fatal — fallback to the sentinel string.
    // ------------------------------------------------------------------
    const scrapedTargets = await Promise.all(
      targets.map(async (t) => {
        try {
          const result = await firecrawl.scrape(t.url, { formats: ["html"] });
          return { ...t, html: result.html ?? "" };
        } catch (e) {
          console.warn(
            `[competitor_agent] Firecrawl failed for ${t.url}: ${
              e instanceof Error ? e.message : String(e)
            }`
          );
          return { ...t, html: "Website could not be scraped" };
        }
      })
    );

    // ------------------------------------------------------------------
    // 8. Analyse all competitors in parallel via Claude + Tavily tool use
    // ------------------------------------------------------------------
    const analyses = await Promise.all(
      scrapedTargets.map((t) =>
        analyzeCompetitor(t.url, t.competitor_type, t.html, clientLocation)
      )
    );

    // ------------------------------------------------------------------
    // 9. Save each result to dlb_competitor_agent_results
    // ------------------------------------------------------------------
    for (const result of analyses) {
      const { error: insertError } = await supabaseAdmin
        .from("dlb_competitor_agent_results")
        .insert({
          dlb_audit_inputs_id: audit_input_id,
          company_name: result.company_name,
          company_url: result.company_url,
          size: result.size,
          location: result.location,
          competitor_type: result.competitor_type,
          social_links: result.social_links,
          advantage: result.advantage,
          disadvantage: result.disadvantage,
          leadership: result.leadership,
          established_date: result.established_date,
        });

      if (insertError) {
        throw new Error(
          `Failed to save competitor ${result.company_url}: ${insertError.message}`
        );
      }
    }

    // ------------------------------------------------------------------
    // 10. Mark Done
    // ------------------------------------------------------------------
    await supabaseAdmin
      .from("dlb_audit_inputs")
      .update({ status: "Done", status_updated_at: new Date().toISOString() })
      .eq("id", audit_input_id);

    await supabaseAdmin
      .from("workflow_runs")
      .update({ status: "Done", completed_at: new Date().toISOString() })
      .eq("id", workflowRunId);

    return NextResponse.json({
      success: true,
      competitors_analyzed: analyses.length,
    });
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "An unknown error occurred";
    console.error("[competitor_agent]", errorMessage);

    if (auditInputId) {
      await supabaseAdmin
        .from("dlb_audit_inputs")
        .update({
          status: "Failed",
          error_message: errorMessage,
          status_updated_at: new Date().toISOString(),
        })
        .eq("id", auditInputId);
    }

    if (workflowRunId) {
      await supabaseAdmin
        .from("workflow_runs")
        .update({
          status: "Failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", workflowRunId);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
