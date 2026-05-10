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
  if (typeof json.competitor_error === "string") {
    report.competitorError = json.competitor_error;
  }
  if (typeof json.social_error === "string") {
    report.socialMediaError = json.social_error;
  }
  return report;
}
