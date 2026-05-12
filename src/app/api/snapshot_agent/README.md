# Snapshot Agent

`POST /api/snapshot_agent`

Generates a concise, executive-ready Brand Snapshot PDF for a completed audit. It is triggered manually by the client — the "Download Snapshot" button appears in the audit layout once all audit agents have finished running.

---

## What it does

The agent runs five steps in sequence:

1. **Fetch audit data** — pulls all available results for the given `audit_input_id` from five Supabase tables concurrently. Missing sections (e.g. social media was skipped) are handled gracefully.

2. **Calculate the Enid Score** — averages all numeric scores found across the website eval, brand eval, and social media results. No LLM involved. Returns a single 0–100 integer.

3. **SEO visibility check** — runs two Tavily searches (`"[company name]"` and `"[company name] review"`) and classifies the company's online presence as:
   - **Strong** — website, social profiles, and press all appear in results
   - **Moderate** — two of the three are present
   - **Weak** — one or none are present

4. **Snapshot synthesis (Claude)** — passes all fetched data plus the Enid Score and visibility results to `claude-sonnet-4-6`. The agent returns a single structured JSON object covering: executive summary, top 5 brand value leaks, brand signal snapshot, website signal snapshot, visibility snapshot, top 3 fixes, and a recommended next step. See `prompts.ts` for the full system prompt.

5. **PDF generation** — renders the snapshot as a branded PDF using `@react-pdf/renderer`, matching the visual style of the full audit PDF. The PDF is returned directly as a download (`application/pdf`).

---

## Input

```json
{ "audit_input_id": "uuid" }
```

## Output

A downloadable PDF file (`enid-snapshot-{company-name}.pdf`).

---

## Auth

Requires an active admin session. The route calls `requireAdmin()` and returns `401` if the check fails.

---

## Files

| File | Purpose |
|---|---|
| `route.ts` | Main route handler — fetching, scoring, Tavily, Claude, PDF |
| `prompts.ts` | System prompt for the Claude snapshot agent |
| `../../components/SnapshotPDFTemplate.tsx` | React-PDF document component and exported types |

---

## Data sources

| Table | FK column | Contains |
|---|---|---|
| `dlb_audit_inputs` | `id` | Company info (name, URL, industry, etc.) |
| `dlb_brand_eval_results` | `dlb_audit_input_id` | Brand scores (lowercase `score` key per field) |
| `dlb_website_eval_results` | `dlb_audit_inputs_id` | Website scores (capital `Score` key per field) |
| `dlb_social_media_agent_results` | `audit_input_id` | Per-platform scores + `overal_evaluation` JSON |
| `dlb_competitor_agent_results` | `dlb_audit_inputs_id` | Competitor profiles (context only, no scores) |
