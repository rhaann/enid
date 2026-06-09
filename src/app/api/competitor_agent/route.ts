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
async function searchExa(
  query: string,
  numResults: number,
  excludeDomains: string[] = []
): Promise<string[]> {
  if (numResults <= 0) return [];

  const body: Record<string, unknown> = {
    query,
    numResults,
    type: "auto",
    // Only return results classified as company websites — prevents EXA from
    // returning article/blog pages that merely discuss competitors.
    category: "company",
  };
  if (excludeDomains.length > 0) {
    body.excludeDomains = excludeDomains;
  }

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.EXA_API_KEY!,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`EXA search failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { results?: ExaResult[] };
  return (data.results ?? [])
    .map((r) => r.url)
    .filter(Boolean)
    .filter(isCompanyUrl);
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
    "Scraped HTML (truncated to 30,000 chars):",
    scraped_html.slice(0, 30_000) || "Website could not be scraped",
  ].join("\n");

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userContent },
  ];

  // Allow up to 8 turns: 1 initial response + 1 Tavily search for location + 1
  // follow-up = 3 turns needed in the typical case. 8 gives a generous buffer.
  const MAX_TURNS = 8;

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
// Competitor name discovery via Claude + Tavily
// ---------------------------------------------------------------------------

/**
 * Asks Claude to identify real direct competitors of the given company by name.
 * Claude has access to the Tavily web_search tool so it can look up live data
 * for lesser-known companies (local PE firms, niche consultancies, etc.) where
 * training knowledge is sparse or absent.
 *
 * For well-known brands Claude answers from training data without a tool call.
 * For obscure companies it searches Tavily before answering.
 *
 * Returns an array of company name strings (not URLs). The caller is responsible
 * for resolving each name to an official website URL via EXA.
 *
 * @param companyName - The client company's name.
 * @param industry    - Industry / sector, if known.
 * @param city        - City the client operates in, for local competitor context.
 * @param exclude     - Company names already confirmed (Case B top-up).
 * @param count       - How many competitor names to return.
 */
async function discoverCompetitorNames(
  companyName: string,
  industry: string | undefined,
  city: string,
  exclude: string[] = [],
  count = 4
): Promise<string[]> {
  const lines: string[] = [
    `Identify the top ${count} real, direct competitors of "${companyName}".`,
  ];
  if (industry) lines.push(`Industry: ${industry}`);
  if (city) lines.push(`Location: ${city} (include local competitors if relevant)`);
  if (exclude.length > 0) lines.push(`Exclude (already confirmed): ${exclude.join(", ")}`);
  lines.push(
    "",
    "Competitors must:",
    "- Sell the same or highly similar products/services to the same customers",
    "- Have their own publicly accessible website",
    "- Be real, active companies",
    "",
    "If you are confident you know the competitors from training data, answer directly.",
    "If the company is obscure, local, or niche and you are unsure, use the web_search tool",
    `to search for 'competitors of ${companyName}${industry ? ` ${industry}` : ""}${city ? ` in ${city}` : ""}' before answering.`,
    "",
    `Return ONLY a JSON array of ${count} company names. Example: ["Adidas", "Puma", "Under Armour", "New Balance"]`,
    "No markdown, no explanations — JSON array only."
  );

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: lines.join("\n") },
  ];

  // Allow up to 4 turns: 1 for the initial response, 1 for a Tavily call,
  // 1 for the tool result, 1 for the final answer.
  const MAX_TURNS = 4;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      tools: [TAVILY_TOOL],
      tool_choice: { type: "auto" },
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          let content: string;
          try {
            const { query } = toolUse.input as { query: string };
            content = await callTavily(query);
          } catch (e) {
            content = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
          }
          return { type: "tool_result" as const, tool_use_id: toolUse.id, content };
        })
      );
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    if (response.stop_reason === "end_turn") {
      const text =
        response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          ?.text ?? "[]";
      try {
        const match = text.trim().match(/\[[\s\S]*?\]/);
        const arr = JSON.parse(match?.[0] ?? "[]");
        return Array.isArray(arr)
          ? (arr as unknown[]).filter((s): s is string => typeof s === "string").slice(0, count)
          : [];
      } catch {
        console.warn("[competitor_agent] Failed to parse competitor names:", text.slice(0, 200));
        return [];
      }
    }
  }

  console.warn("[competitor_agent] discoverCompetitorNames exceeded MAX_TURNS");
  return [];
}

// ---------------------------------------------------------------------------
// Homepage lookup via EXA (by company name)
// ---------------------------------------------------------------------------

/**
 * Finds the official homepage of a company given its name.
 * Passes `category: "company"` so EXA returns company websites, not articles.
 *
 * @param name     - Company name, e.g. "Adidas".
 * @param industry - Optional industry hint to disambiguate common names.
 * @param excludeDomains - Domains to exclude (client's own domain, etc.).
 */
async function findCompanyHomepage(
  name: string,
  industry: string | undefined,
  excludeDomains: string[] = []
): Promise<string | null> {
  const query = industry ? `${name} ${industry}` : name;
  // Request 3 results so we have fallbacks if the top hit is a subdomain / redirect
  const results = await searchExa(query, 3, excludeDomains).catch(() => [] as string[]);
  return results[0] ?? null;
}

// ---------------------------------------------------------------------------
// URL quality filter
// ---------------------------------------------------------------------------

/**
 * Returns false if the URL is clearly an article, blog post, or other
 * non-homepage page. Acts as a lightweight guard after EXA discovery.
 *
 * The primary guard is the `category: "company"` filter on the EXA request;
 * this is a belt-and-suspenders fallback for any edge cases that slip through.
 */
function isCompanyUrl(url: string): boolean {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const path = parsed.pathname;
    // Reject obvious article / blog paths
    if (/\/(blog|article|post|news|case[-_]study|guide|analysis|wiki)/i.test(path)) {
      return false;
    }
    // Reject if the path is 3+ segments deep — almost certainly not a homepage
    const segments = path.split("/").filter(Boolean);
    if (segments.length >= 3) return false;
    return true;
  } catch {
    return true; // Unparseable URL — let it through; Claude will handle it
  }
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
    console.log(`[competitor_agent] Starting for audit ${audit_input_id}`);
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
        .select("id")
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
    // 5. Resolve confirmed competitor URLs and client context
    // ------------------------------------------------------------------
    const confirmedUrls = parseCompetitorUrls(auditInput.competitor_urls);
    const ownDomain = normalizeDomain((auditInput.url as string) ?? "");
    const exaExclude = ownDomain ? [ownDomain] : [];
    // Prefer the explicit location field; fall back to target_location for old records
    const clientLocation = (auditInput.location as string) || (auditInput.target_location as string) || "";
    // City = everything before the first comma (e.g. "Nashville" from "Nashville, TN, USA")
    const clientCity = clientLocation.includes(",")
      ? clientLocation.split(",")[0].trim()
      : clientLocation;
    const industry = (auditInput.industry as string | undefined) || undefined;

    let targets: CompetitorTarget[] = [];

    // ------------------------------------------------------------------
    // 6. Determine competitor target list
    //
    // Strategy: use Claude (Haiku) to identify real competitor names, then
    // use EXA to resolve each name to an official website URL. This is far
    // more accurate than asking EXA to discover competitors directly — EXA's
    // neural search returns pages semantically related to the brand (licensees,
    // partners, analysis sites) instead of actual competitor homepages.
    // ------------------------------------------------------------------

    if (confirmedUrls.length >= 4) {
      // Case A: client provided 4+ URLs — use as-is, skip all discovery.
      // analyzeCompetitor will determine the correct competitor_type from the
      // actual headquarters location.
      targets = confirmedUrls
        .slice(0, 4)
        .map((url) => ({ url, competitor_type: "national" as const }));

    } else if (confirmedUrls.length >= 1) {
      // Case B: 1–3 confirmed URLs — ask Claude for the names of the missing
      // competitors, then resolve each name to a homepage via EXA.
      const needed = 4 - confirmedUrls.length;
      const confirmedDomains = confirmedUrls.map(normalizeDomain);
      const additionalNames = await discoverCompetitorNames(
        (auditInput.name as string) ?? "this company",
        industry,
        clientCity,
        [], // names of confirmed are unknown; dedup by domain below
        needed + 1 // request one extra as buffer in case a URL isn't found
      );

      const additionalExclude = [...exaExclude, ...confirmedDomains];
      const additionalUrls = await Promise.all(
        additionalNames.map((name) => findCompanyHomepage(name, industry, additionalExclude))
      );

      targets = [
        ...confirmedUrls.map((url) => ({ url, competitor_type: "national" as const })),
        ...additionalUrls
          .filter((url): url is string => url !== null)
          .map((url) => ({ url, competitor_type: "national" as const })),
      ];

    } else {
      // Case C: no confirmed URLs — full Claude-driven discovery.
      const names = await discoverCompetitorNames(
        (auditInput.name as string) ?? "this company",
        industry,
        clientCity,
        [],
        5 // request 5 so we have a buffer if one URL lookup fails
      );

      if (names.length === 0) {
        throw new Error(
          "Could not identify competitors for this company. Add competitor URLs manually and retry."
        );
      }

      const urls = await Promise.all(
        names.map((name) => findCompanyHomepage(name, industry, exaExclude))
      );

      targets = urls
        .filter((url): url is string => url !== null)
        .map((url) => ({ url, competitor_type: "national" as const }));
    }

    // Dedupe by domain and drop the client's own domain.
    targets = dedupeAndLimit(targets, ownDomain, 4);
    console.log(`[competitor_agent] ${targets.length} targets after dedup:`, targets.map((t) => t.url));

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
    //    Use allSettled so one bad URL doesn't kill the whole batch.
    // ------------------------------------------------------------------
    console.log(`[competitor_agent] Analysing ${scrapedTargets.length} competitors in parallel`);
    const settledAnalyses = await Promise.allSettled(
      scrapedTargets.map((t) =>
        analyzeCompetitor(t.url, t.competitor_type, t.html, clientLocation)
      )
    );

    const analyses = settledAnalyses
      .map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        console.warn(
          `[competitor_agent] Analysis failed for ${scrapedTargets[i].url}:`,
          r.reason instanceof Error ? r.reason.message : String(r.reason)
        );
        return null;
      })
      .filter((r): r is CompetitorResult => r !== null);

    if (analyses.length === 0) {
      throw new Error(
        "All competitor analyses failed. Check Anthropic/Tavily API keys and logs."
      );
    }

    // Post-analysis dedup: remove the client's own company if it slipped through
    // (happens when ownDomain is empty or EXA returned a subdomain/alternate URL),
    // and deduplicate by normalized company_url domain in case two URLs resolved
    // to the same company.
    const postSeenDomains = new Set<string>();
    if (ownDomain) postSeenDomains.add(ownDomain);

    const dedupedAnalyses = analyses.filter((r) => {
      const domain = normalizeDomain(r.company_url);
      if (!domain || postSeenDomains.has(domain)) {
        console.warn(`[competitor_agent] Post-analysis dedup removed duplicate/own-company: ${r.company_url}`);
        return false;
      }
      postSeenDomains.add(domain);
      return true;
    });

    if (dedupedAnalyses.length === 0) {
      throw new Error(
        "All competitor results were the client's own company or duplicates. EXA may have returned the client's own URLs."
      );
    }

    console.log(`[competitor_agent] ${dedupedAnalyses.length}/${scrapedTargets.length} analyses succeeded`);

    // ------------------------------------------------------------------
    // 9. Save each result to dlb_competitor_agent_results
    // ------------------------------------------------------------------
    for (const result of dedupedAnalyses) {
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
    // 10. Mark Done (workflow_runs only — dlb_audit_inputs.status is owned
    //     by the evaluator agent and must not be overwritten here)
    // ------------------------------------------------------------------
    await supabaseAdmin
      .from("workflow_runs")
      .update({ status: "Done", completed_at: new Date().toISOString() })
      .eq("id", workflowRunId);

    console.log(`[competitor_agent] Done — saved ${dedupedAnalyses.length} competitors for audit ${audit_input_id}`);
    return NextResponse.json({
      success: true,
      competitors_analyzed: dedupedAnalyses.length,
    });
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "An unknown error occurred";
    console.error("[competitor_agent]", errorMessage);

    // Only update workflow_runs — do not touch dlb_audit_inputs.status, which
    // is owned by the evaluator agent.
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
