# Competitor Agent

`POST /api/competitor_agent`

Discovers, scrapes, and analyses up to 6 competitors for a given audit. Runs automatically after the Evaluator Agent completes, or can be called directly via the internal secret.

## What it does

```
POST /api/competitor_agent
{ "audit_input_id": "<uuid>" }
```

**Step-by-step flow:**

1. **Auth check** — accepts an admin session cookie OR an `x-internal-secret` header for server-to-server calls from the evaluator agent.
2. **Create workflow run** — inserts a `workflow_runs` row with `workflow_name: "competitor-agent"` and `status: "In Progress"`.
3. **Fetch audit input** — loads the full `dlb_audit_inputs` row (URL, industry, goals, location, competitor URLs).
4. **Fetch evaluator results** — checks that `dlb_brand_eval_results` or `dlb_website_eval_results` exist. Returns `422` if the evaluator hasn't run yet.
5. **Build competitor target list** — pure TypeScript, no LLM:
   - **6+ confirmed URLs provided**: use the first 6 directly.
   - **1–5 confirmed URLs**: top up the remainder with EXA searches split across local / national / global.
   - **No confirmed URLs**: run 3 EXA searches (4 results each) targeting local, national, and global competitors. "Local" uses the city extracted from `dlb_audit_inputs.location`.
   - Deduplicates by domain and strips the client's own domain from the list.
6. **Scrape each competitor** — Firecrawl scrapes each URL for HTML (parallel). Failures fall back to a sentinel string so the agent can still run.
7. **Analyse each competitor** — Claude analyses each one in parallel using a multi-turn tool-use loop:
   - Extracts: company name, URL, size, location, competitor type, social links, advantages, disadvantages, leadership, founded year.
   - **Competitor type** is always determined by Claude from actual location data (`local` = same city, `national` = same country, `global` = different country). The EXA search category is passed as a hint only.
   - If any field (location, leadership, founded year) is missing from the scraped HTML, Claude calls the `web_search` (Tavily) tool to look it up — maximum 1 search per missing field, up to 12 turns total.
8. **Save results** — one row per competitor inserted into `dlb_competitor_agent_results`.
9. **Mark Done** — updates `workflow_runs` and `dlb_audit_inputs` to `"Done"`.
10. **On any error** — marks both records as `"Failed"` with the error message.

## Files

| File | Purpose |
|------|---------|
| `route.ts` | Orchestration, EXA search, Firecrawl scraping, Claude tool-use loop |
| `prompts.ts` | `ANALYZE_COMPETITOR_SYSTEM_PROMPT` — instructs Claude on what to extract and when to search |

## Competitor type classification

| Type | Meaning |
|------|---------|
| `local` | Same city as the client |
| `national` | Same country as the client, different city |
| `global` | Different country |

The client's location is read from `dlb_audit_inputs.location`, falling back to `target_location` for older records.

## Required environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS for inserts) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `FIRECRAWL_API_KEY` | Firecrawl API key for scraping competitor websites |
| `EXA_API_KEY` | EXA API key for competitor discovery searches |
| `TAVILY_API_KEY` | Tavily API key for Claude's `web_search` tool |
| `INTERNAL_API_SECRET` | Shared secret that allows the evaluator agent to call this route server-to-server |

## Database tables

| Table | Read / Write | Notes |
|-------|-------------|-------|
| `dlb_audit_inputs` | Read + Update | Source of truth; status updated to Done/Failed |
| `dlb_brand_eval_results` | Read | Used to build the EXA search query and verify the evaluator ran |
| `dlb_website_eval_results` | Read | Fallback check that the evaluator ran |
| `workflow_runs` | Insert + Update | Tracks this specific agent run; polled by the UI |
| `dlb_competitor_agent_results` | Insert | One row per competitor analysed |

## Security

Accepts either an authenticated admin session (`requireAdmin()`) or the `x-internal-secret` header matching `INTERNAL_API_SECRET`. The route uses the Supabase **service role key** for all DB writes to bypass RLS.

## Timeouts

`maxDuration = 300` (5 minutes) — set for Vercel. Firecrawl scraping and the Claude tool-use loops for 6 competitors in parallel are the longest steps.
