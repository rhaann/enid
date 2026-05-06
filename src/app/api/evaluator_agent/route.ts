export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import FirecrawlApp from "@mendable/firecrawl-js";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/supabase/auth";
import {
  URL_FILTER_SYSTEM_PROMPT,
  WEBSITE_EVAL_SYSTEM_PROMPT,
  BRAND_DEEP_DIVE_SYSTEM_PROMPT,
} from "./prompts";

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
// URL helpers
// ---------------------------------------------------------------------------

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  // Prepend https:// if no protocol is present
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  // Let the URL constructor validate it — throws a TypeError on invalid input
  const parsed = new URL(withProtocol);
  return parsed.toString();
}

// ---------------------------------------------------------------------------
// Step tracking helpers
// Each agent step gets its own workflow_runs row so the UI can show progress.
// ---------------------------------------------------------------------------

async function startStep(auditInputId: string, name: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("workflow_runs")
    .insert({ audit_input_id: auditInputId, workflow_name: name, status: "In Progress" })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create step "${name}": ${error.message}`);
  return data.id as string;
}

async function completeStep(stepId: string, failed = false, errorMsg?: string) {
  await supabaseAdmin
    .from("workflow_runs")
    .update({
      status: failed ? "Failed" : "Done",
      completed_at: new Date().toISOString(),
      ...(errorMsg ? { error_message: errorMsg } : {}),
    })
    .eq("id", stepId);
}

// ---------------------------------------------------------------------------
// JSON response parser
// ---------------------------------------------------------------------------

function parseJsonResponse(raw: string, agentName: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`${agentName} returned invalid JSON: ${trimmed.slice(0, 300)}`);
    }
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      throw new Error(`${agentName} returned unparseable JSON: ${match[0].slice(0, 300)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Accept either an admin browser session OR a server-to-server internal secret.
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

  let auditInputId: string | null = null;

  try {
    // 1. Parse request
    const body = await req.json().catch(() => null);
    const { audit_input_id } = (body ?? {}) as { audit_input_id?: string };

    if (!audit_input_id) {
      return NextResponse.json({ error: "audit_input_id is required." }, { status: 400 });
    }
    auditInputId = audit_input_id;

    const host = req.headers.get("host") ?? "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const appUrl = `${proto}://${host}`;

    // 2. Fetch audit input row
    const { data: auditInput, error: fetchError } = await supabaseAdmin
      .from("dlb_audit_inputs")
      .select("*")
      .eq("id", audit_input_id)
      .single();

    if (fetchError || !auditInput) {
      throw new Error(
        `Failed to fetch audit input ${audit_input_id}: ${fetchError?.message ?? "Not found"}`
      );
    }

    // 3. Mark audit as In Progress
    await supabaseAdmin
      .from("dlb_audit_inputs")
      .update({ status: "In Progress", status_updated_at: new Date().toISOString() })
      .eq("id", audit_input_id);

    // -----------------------------------------------------------------------
    // Step 1: URL Discovery
    // -----------------------------------------------------------------------
    const urlDiscoveryStepId = await startStep(audit_input_id, "URL Discovery");
    let mappedLinks: { url: string; title?: string; description?: string }[] = [];
    try {
      let siteUrl: string;
      try {
        siteUrl = normalizeUrl(auditInput.url as string);
      } catch {
        throw new Error(`Invalid URL "${auditInput.url}" — please update it to a valid website address.`);
      }
      const mapResult = await firecrawl.map(siteUrl);
      mappedLinks = mapResult.links ?? [];
      if (mappedLinks.length === 0) {
        throw new Error(`Firecrawl map returned no URLs for ${auditInput.url}`);
      }
      await completeStep(urlDiscoveryStepId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await completeStep(urlDiscoveryStepId, true, msg);
      throw new Error(`URL Discovery failed: ${msg}`);
    }

    // -----------------------------------------------------------------------
    // Step 2: URL Filter (Claude picks the 8 most relevant pages)
    // -----------------------------------------------------------------------
    const urlFilterStepId = await startStep(audit_input_id, "URL Filter");
    let selectedUrls: string[] = [];
    try {
      const filterMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: URL_FILTER_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: JSON.stringify(mappedLinks) }],
      });

      const filterContent = filterMessage.content[0];
      if (filterContent.type !== "text") {
        throw new Error("URL Filter Agent returned a non-text response block");
      }

      const filterResult = parseJsonResponse(filterContent.text, "URL Filter Agent");
      selectedUrls = ((filterResult.keep as string[]) ?? []).slice(0, 8);

      if (selectedUrls.length === 0) {
        throw new Error("URL Filter Agent selected no URLs to scrape");
      }
      await completeStep(urlFilterStepId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await completeStep(urlFilterStepId, true, msg);
      throw new Error(`URL Filter failed: ${msg}`);
    }

    // -----------------------------------------------------------------------
    // Step 3: Scraping
    // -----------------------------------------------------------------------
    const scrapingStepId = await startStep(audit_input_id, "Scraping");
    const scrapedPages: { url: string; html: string }[] = [];
    try {
      for (const url of selectedUrls) {
        const scrapeResult = await firecrawl.scrape(url, { formats: ["html"] });
        const html = scrapeResult.html ?? "";

        const { error: insertError } = await supabaseAdmin
          .from("dlb_audit_scraped_websites")
          .insert({ dlb_audit_inputs_id: audit_input_id, specific_url: url, html });

        if (insertError) {
          throw new Error(`Failed to save scraped page ${url}: ${insertError.message}`);
        }

        scrapedPages.push({ url, html });
      }
      await completeStep(scrapingStepId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await completeStep(scrapingStepId, true, msg);
      throw new Error(`Scraping failed: ${msg}`);
    }

    // Combine HTML — cap at 500K chars to stay within Claude's context window
    const MAX_HTML_CHARS = 500_000;
    let combinedHtml = scrapedPages
      .map((p) => `\n\n--- Page: ${p.url} ---\n${p.html}`)
      .join("");
    if (combinedHtml.length > MAX_HTML_CHARS) {
      combinedHtml =
        combinedHtml.slice(0, MAX_HTML_CHARS) + "\n\n[Content truncated due to size]";
    }

    // Shared user message for both eval agents
    const agentUserMessage = [
      `- Objectives: ${JSON.stringify(auditInput.objective ?? [])}`,
      `- Business Goals: ${(auditInput.business_goals as string) ?? "Not provided"}`,
      `- Company Stage: ${(auditInput.company_stage as string) ?? "Not provided"}`,
      `- Industry: ${(auditInput.industry as string) ?? "Not provided"}`,
      `- Company Size: ${(auditInput.company_size as string) ?? "Not provided"}`,
      `- Scraped HTML (all pages combined): ${combinedHtml}`,
    ].join("\n");

    // -----------------------------------------------------------------------
    // Steps 4 & 5: Website Eval + Brand Deep Dive (parallel)
    // -----------------------------------------------------------------------
    const websiteEvalStepId = await startStep(audit_input_id, "Website Eval");
    const brandDeepDiveStepId = await startStep(audit_input_id, "Brand Deep Dive");

    const [websiteEvalResult, brandDeepDiveResult] = await Promise.all([
      // Website Eval Agent
      (async () => {
        try {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 16000,
            system: [
              {
                type: "text",
                text: WEBSITE_EVAL_SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [{ role: "user", content: agentUserMessage }],
          });
          const message = await stream.finalMessage();
          const content = message.content[0];
          if (content.type !== "text") {
            throw new Error("Website Eval Agent returned a non-text response block");
          }
          const result = parseJsonResponse(content.text, "Website Eval Agent");
          await completeStep(websiteEvalStepId);
          return result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await completeStep(websiteEvalStepId, true, msg);
          throw e;
        }
      })(),

      // Brand Deep Dive Agent
      (async () => {
        try {
          const stream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 16000,
            system: [
              {
                type: "text",
                text: BRAND_DEEP_DIVE_SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [{ role: "user", content: agentUserMessage }],
          });
          const message = await stream.finalMessage();
          const content = message.content[0];
          if (content.type !== "text") {
            throw new Error("Brand Deep Dive Agent returned a non-text response block");
          }
          const result = parseJsonResponse(content.text, "Brand Deep Dive Agent");
          await completeStep(brandDeepDiveStepId);
          return result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await completeStep(brandDeepDiveStepId, true, msg);
          throw e;
        }
      })(),
    ]);

    // -----------------------------------------------------------------------
    // Save results
    // -----------------------------------------------------------------------
    const { error: websiteInsertError } = await supabaseAdmin
      .from("dlb_website_eval_results")
      .insert({
        dlb_audit_inputs_id: audit_input_id,
        website_overview: websiteEvalResult["Website Overview"] ?? null,
        brand_expression_and_visual_execution:
          websiteEvalResult["Brand Expression & Visual Execution"] ?? null,
        messaging_and_clarity: websiteEvalResult["Messaging & Clarity"] ?? null,
        ux_navigation: websiteEvalResult["UX & Navigation"] ?? null,
        accessibility_and_contrast: websiteEvalResult["Accessibility & Contrast"] ?? null,
        ctas_trust_and_conversion: websiteEvalResult["CTAs, Trust & Conversion"] ?? null,
        social_consistency_check: websiteEvalResult["Social Consistency Check"] ?? null,
        risk_and_confidence_framing: websiteEvalResult["Risk and Confidence Framing"] ?? null,
        final_synthesis: websiteEvalResult["Final Synthesis"] ?? null,
      });

    if (websiteInsertError) {
      throw new Error(`Failed to save website eval results: ${websiteInsertError.message}`);
    }

    const { error: brandInsertError } = await supabaseAdmin
      .from("dlb_brand_eval_results")
      .insert({
        dlb_audit_input_id: audit_input_id,
        brand_overview: brandDeepDiveResult["Brand Overview"] ?? null,
        who_you_are: brandDeepDiveResult["Who You Are"] ?? null,
        how_you_look: brandDeepDiveResult["How You Look"] ?? null,
        how_you_sound: brandDeepDiveResult["How You Sound"] ?? null,
        who_you_serve: brandDeepDiveResult["Who You Serve"] ?? null,
        position_and_market_fit: brandDeepDiveResult["Position and Market Fit"] ?? null,
        ninety_day_plan_summary: brandDeepDiveResult["Ninety Day Plan Summary"] ?? null,
        brand_health: (brandDeepDiveResult["Brand Health"] as string) ?? null,
      });

    if (brandInsertError) {
      throw new Error(`Failed to save brand deep dive results: ${brandInsertError.message}`);
    }

    // -----------------------------------------------------------------------
    // Mark audit as Done
    // -----------------------------------------------------------------------
    await supabaseAdmin
      .from("dlb_audit_inputs")
      .update({ status: "Done", status_updated_at: new Date().toISOString() })
      .eq("id", audit_input_id);

    // Fire competitor and social media agents in parallel — don't await so the
    // evaluator returns immediately and both agents run independently.
    const agentPayload = JSON.stringify({ audit_input_id });
    const agentHeaders = {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
    };

    fetch(`${appUrl}/api/competitor_agent`, {
      method: "POST",
      headers: agentHeaders,
      body: agentPayload,
    }).catch((err) => {
      console.error("[evaluator_agent] Failed to trigger competitor agent:", err);
    });

    fetch(`${appUrl}/api/social_media_agent`, {
      method: "POST",
      headers: agentHeaders,
      body: agentPayload,
    }).catch((err) => {
      console.error("[evaluator_agent] Failed to trigger social media agent:", err);
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
    console.error("[evaluator_agent]", errorMessage);

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

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
