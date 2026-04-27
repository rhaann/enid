export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

// DB enum: "Triggered", "In Progress", "Done", "Failed"
// Frontend:  "not_started", "in_progress", "done", "failed"
const STATUS_MAP: Record<string, string> = {
  "triggered": "in_progress",
  "in progress": "in_progress",
  "done": "done",
  "failed": "failed",
};

function normalizeStatus(raw: string | null | undefined): string {
  if (!raw) return "not_started";
  return STATUS_MAP[raw.toLowerCase()] ?? "not_started";
}

function mimeToLabel(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "PNG",
    "image/jpeg": "JPG",
    "image/svg+xml": "SVG",
    "image/webp": "WEBP",
    "application/pdf": "PDF",
  };
  return map[mime] ?? mime.split("/").pop()?.toUpperCase() ?? "FILE";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase()
    .from("dlb_audit_inputs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to load audits." }, { status: 500 });
  }

  const auditIds = (data ?? []).map((r: any) => r.id);

  let assetsByAudit: Record<string, any[]> = {};
  if (auditIds.length > 0) {
    const { data: allAssets } = await supabase()
      .from("assets")
      .select("id, audit_input_id, file_name, file_type, file_size_bytes, storage_path")
      .in("audit_input_id", auditIds)
      .order("created_at", { ascending: true });

    for (const a of allAssets ?? []) {
      const key = a.audit_input_id;
      if (!assetsByAudit[key]) assetsByAudit[key] = [];
      assetsByAudit[key].push(a);
    }
  }

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    clientName: r.email ? r.email.split("@")[0] : "Unknown",
    clientEmail: r.email ?? "",
    companyName: r.name ?? "",
    companyDomain: r.url ?? "",
    submittedAt: r.created_at ? r.created_at.split("T")[0] : "",
    callDate: null,
    callTime: null,
    callEndTime: null,
    status: normalizeStatus(r.status),
    companyStage: r.company_stage ?? "",
    companySize: r.company_size ?? "",
    industry: r.industry ?? "",
    objectives: Array.isArray(r.objective) ? r.objective : [],
    purchased: [],
    social: {
      linkedin: r.linkedin_url ?? undefined,
      twitter: r.x_url ?? undefined,
      facebook: r.facebook_url ?? undefined,
      instagram: r.instagram_url ?? undefined,
      pinterest: r.pinterest_url ?? undefined,
      youtube: r.youtube_url ?? undefined,
      tiktok: r.tiktok_url ?? undefined,
    },
    businessGoals: r.business_goals ?? "",
    brandAssets: (assetsByAudit[r.id] ?? []).map((a: any) => ({
      id: a.id,
      name: a.file_name ?? "Unnamed",
      type: mimeToLabel(a.file_type ?? ""),
      size: formatBytes(a.file_size_bytes ?? 0),
    })),
    competitorWebsites: Array.isArray(r.competitor_urls) ? r.competitor_urls : [],
    targetLocation: r.target_location ?? "",
    activity: [],
    notes: r.admin_notes ?? "",
    errorMessage: r.error_message ?? "",
  }));

  return Response.json(rows);
}
