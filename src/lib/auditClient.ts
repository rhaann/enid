"use client";

import type { AuditReport } from "./auditModel";
import { mapWebhookToAudit } from "./mapWebhook";

/**
 * Fetch a fully-mapped AuditReport from the server by audit-input ID.
 */
export async function fetchAuditById(id: string): Promise<AuditReport> {
  const res = await fetch(`/api/audit-results/${id}`);
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error || "Failed to load audit results.");
  }

  const report = mapWebhookToAudit(json.data);
  if (json.companyName) {
    report.companyName = json.companyName;
  }
  if (json.createdAt) {
    report.createdAt = json.createdAt;
  }
  if (json.status) {
    report.auditStatus = json.status;
  }
  if (json.activeAgents) {
    report.activeAgents = json.activeAgents;
  }
  // "No data was returned" is a soft / informational signal — the agent ran (or
  // the pipeline settled) but produced no rows. Show "Not Available" in the UI
  // rather than an amber "Error" card. Any other message is a real agent error.
  const SOFT_NO_DATA = "No competitor data was returned for this audit.";
  const SOFT_NO_SOCIAL = "No social media data was returned for this audit.";

  if (typeof json.competitor_error === "string") {
    if (json.competitor_error === SOFT_NO_DATA) {
      report.competitorSettled = true;
    } else {
      report.competitorError = json.competitor_error;
    }
  }
  if (typeof json.social_error === "string") {
    if (json.social_error === SOFT_NO_SOCIAL) {
      report.socialSettled = true;
    } else {
      report.socialMediaError = json.social_error;
    }
  }
  return report;
}
