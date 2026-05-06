# Social Media Agent

`POST /api/social_media_agent`

Discovers the client's social media profiles, audits each platform with Claude, then synthesises all results into a cross-platform strategic report. Runs automatically after the Evaluator Agent completes, or can be called directly via the internal secret.

## What it does

```
POST /api/social_media_agent
{ "audit_input_id": "<uuid>" }
```

**Step-by-step flow:**

1. **Auth check** — accepts an admin session cookie OR an `x-internal-secret` header for server-to-server calls from the evaluator agent.
2. **Create workflow run** — inserts a `workflow_runs` row with `workflow_name: "social-media-agent"` and `status: "In Progress"`.
3. **Fetch audit input** — loads the full `dlb_audit_inputs` row (including any manually provided social URLs: LinkedIn, X, Facebook, Instagram, YouTube, TikTok, Pinterest).
4. **Verify evaluator completed** — checks that `dlb_brand_eval_results` or `dlb_website_eval_results` exist. Returns `422` if the evaluator hasn't run yet.
5. **Fetch scraped HTML** — loads all HTML from `dlb_audit_scraped_websites` (capped at 200K characters) to help discover social URLs embedded in the client's website.
6. **URL Filter Agent** — Claude combines the user-provided social URLs with any found in the scraped HTML and returns a deduplicated list of `{ platform, url }` pairs. Only actual profile pages are included (no share buttons or bare domain links). Returns `422` if no profiles are found.
7. **Crawl each profile with Tavily** — each profile URL is searched using Tavily's advanced search (parallel). Failures are non-fatal — a "Profile could not be crawled" placeholder is used so the audit still runs.
8. **Audit each platform with Claude** — each profile is analysed in parallel using a platform-specific prompt. Claude scores 6 dimensions (0–100 each):
   - **A. Profile Completeness** — bio, imagery, links, featured sections
   - **B. Content Quality** — production quality, captions, originality
   - **C. Brand Alignment** — visual and messaging consistency with the brand
   - **D. Audience Engagement** — reactions, comments, shares relative to follower count
   - **E. Posting Frequency** — recency and cadence vs platform best practices
   - **F. Visual Consistency** — colours, fonts, template usage
9. **Cross-Platform Evaluation** — Claude synthesises all platform results and brand context into a cross-platform report covering brand consistency, content coherence, audience alignment, channel coverage, and resource allocation. Produces a 90-day action plan and executive narrative.
10. **Save results** — one row per platform inserted into `dlb_social_media_agent_results`. The full cross-platform JSON is stored as `overal_evaluation` on each row.
11. **Mark Done** — updates `workflow_runs` and `dlb_audit_inputs` to `"Done"`.
12. **On any error** — marks both records as `"Failed"` with the error message.

## Supported platforms

LinkedIn, Instagram, Twitter/X, Facebook, YouTube, TikTok, Pinterest

## Scoring framework

Scores are integers 0–100 per category. Signal caps apply:

| Threshold | Requires |
|-----------|---------|
| > 70 | Consistent activity within the last 30 days |
| > 80 | Clear brand alignment AND demonstrated content quality |
| > 90 | Measurable audience engagement AND strategic posting cadence |
| > 95 | Exceptional community building AND platform-native innovation |

`platform_average` is the mean of all 6 category scores.

## Files

| File | Purpose |
|------|---------|
| `route.ts` | Orchestration, Tavily crawling, Claude audit calls, DB writes |
| `prompts.ts` | All system prompts: URL Filter, 7 platform-specific audits, Cross-Platform Evaluation |

## Required environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS for inserts) |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `TAVILY_API_KEY` | Tavily API key for crawling social profiles |
| `INTERNAL_API_SECRET` | Shared secret that allows the evaluator agent to call this route server-to-server |

## Database tables

| Table | Read / Write | Notes |
|-------|-------------|-------|
| `dlb_audit_inputs` | Read + Update | Source of truth; status updated to Done/Failed |
| `dlb_brand_eval_results` | Read | Brand context for cross-platform evaluation; also used to verify evaluator ran |
| `dlb_website_eval_results` | Read | Fallback check that the evaluator ran |
| `dlb_audit_scraped_websites` | Read | HTML used by the URL Filter agent to discover social links |
| `workflow_runs` | Insert + Update | Tracks this specific agent run; polled by the UI |
| `dlb_social_media_agent_results` | Insert | One row per platform; `overal_evaluation` column holds the cross-platform JSON |

## Security

Accepts either an authenticated admin session (`requireAdmin()`) or the `x-internal-secret` header matching `INTERNAL_API_SECRET`. The route uses the Supabase **service role key** for all DB writes to bypass RLS.

## Timeouts

`maxDuration = 300` (5 minutes) — set for Vercel. Parallel platform audits and the cross-platform evaluation are the longest steps.
