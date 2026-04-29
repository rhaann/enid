# Evaluator Agent

A Next.js API route that runs a full brand audit for a given company website. It orchestrates three AI sub-agents and saves every result to Supabase.

## What it does

```
POST /api/evaluator_agent
{ "audit_input_id": "<uuid>" }
```

**Step-by-step flow:**

1. **Auth check** — requires an admin session (Supabase cookie). Returns `401` if not authenticated.
2. **Fetch audit input** — loads the `dlb_audit_inputs` row for context (URL, objectives, industry, company stage, size, business goals).
3. **Create workflow run** — inserts a `workflow_runs` row with `status: "In Progress"` and marks the audit input as `"In Progress"`.
4. **Firecrawl map** — calls `firecrawl.map(url)` to discover all pages on the site, returning `{ url, title, description }[]`.
5. **URL Filter Agent** — sends the full URL list to Claude with the URL Filter prompt. Claude picks the 8 most audit-relevant pages (homepage, pricing, about, case studies, etc.) and returns `{ "keep": ["url", ...] }`.
6. **Firecrawl scrape** — scrapes each selected URL for HTML and saves each page to `dlb_audit_scraped_websites`.
7. **Build context message** — combines the scraped HTML (capped at 500K characters) with the audit objectives, goals, stage, industry, and size into a single prompt message.
8. **Two agents in parallel:**
   - **Website Eval Agent** — scores 8 website dimensions (overview, visual execution, messaging, UX, accessibility, CTAs, social consistency, risk framing) and writes a synthesis. Results saved to `dlb_website_eval_results`.
   - **Brand Deep Dive Agent** — scores 6 brand dimensions (overview, identity, look, sound, audience, market fit) and generates a 90-day action plan + brand health summary. Results saved to `dlb_brand_eval_results`.
9. **Mark Done** — updates both `dlb_audit_inputs` and `workflow_runs` to `"Done"`.
10. **On any error** — marks both records as `"Failed"` with the error message.

## Files

| File | Purpose |
|------|---------|
| `route.ts` | Orchestration logic |
| `prompts.ts` | All three system prompts (URL Filter, Website Eval, Brand Deep Dive) |

## Required environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS for inserts) |
| `FIRECRAWL_API_KEY` | Firecrawl API key for mapping and scraping |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

## Database tables

| Table | Read / Write | Notes |
|-------|-------------|-------|
| `dlb_audit_inputs` | Read + Update | Source of truth for the audit; status updated throughout |
| `workflow_runs` | Insert + Update | Tracks this specific agent run |
| `dlb_audit_scraped_websites` | Insert | One row per scraped URL |
| `dlb_website_eval_results` | Insert | Website Eval Agent output |
| `dlb_brand_eval_results` | Insert | Brand Deep Dive Agent output |

## Security

The route is protected by `requireAdmin()` from `@/lib/supabase/auth`. Only users with `profiles.tier = 'admin'` can call it. Unauthenticated or non-admin requests receive `401 Unauthorized`.

The Supabase client inside this route uses the **service role key**, which bypasses Row Level Security. This is intentional — the agent writes to multiple tables on behalf of the user without needing per-table RLS policies.

## Timeouts

`maxDuration = 300` (5 minutes) is set for Vercel. The two eval agent calls are the longest steps; they stream responses via `.stream().finalMessage()` to avoid HTTP timeouts on large inputs.
