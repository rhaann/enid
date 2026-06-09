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

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { companyName, websiteUrl, email, industry, location, targetLocation,
    social, competitorUrls, objectives, companyStage, companySize, businessGoals } =
    body as Record<string, unknown>;

  if (!companyName || !websiteUrl || !email) {
    return Response.json(
      { error: "Company name, website URL, and email are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase()
    .from("dlb_audit_inputs")
    .insert({
      name: companyName as string,
      url: websiteUrl as string,
      email: email as string,
      industry: (industry as string) || null,
      location: (location as string) || null,
      target_location: (targetLocation as string) || null,
      company_stage: (companyStage as string) || null,
      company_size: (companySize as string) || null,
      business_goals: (businessGoals as string) || null,
      objective: Array.isArray(objectives) && objectives.length > 0 ? objectives : null,
      competitor_urls: Array.isArray(competitorUrls) && (competitorUrls as string[]).filter(Boolean).length > 0
        ? (competitorUrls as string[]).filter(Boolean)
        : null,
      linkedin_url: (social as Record<string, string>)?.linkedin || null,
      x_url: (social as Record<string, string>)?.twitter || null,
      facebook_url: (social as Record<string, string>)?.facebook || null,
      instagram_url: (social as Record<string, string>)?.instagram || null,
      pinterest_url: (social as Record<string, string>)?.pinterest || null,
      youtube_url: (social as Record<string, string>)?.youtube || null,
      tiktok_url: (social as Record<string, string>)?.tiktok || null,
      status: null,
      is_test: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[audits/POST] Insert error:", error);
    return Response.json({ error: "Failed to create audit." }, { status: 500 });
  }

  return Response.json({ success: true, id: data.id }, { status: 201 });
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

  // Find audits where social or competitor agents are still actively running.
  // These are "Done" in dlb_audit_inputs (evaluator finished) but the sub-agents
  // haven't settled yet — we surface this as "Finalizing" on the dashboard so
  // admins aren't misled into thinking the full pipeline is complete.
  const agentsStillRunning = new Set<string>();
  if (auditIds.length > 0) {
    const { data: activeRuns } = await supabase()
      .from("workflow_runs")
      .select("audit_input_id")
      .in("audit_input_id", auditIds)
      .in("workflow_name", ["social-media-agent", "competitor-agent"])
      .eq("status", "In Progress");

    for (const run of activeRuns ?? []) {
      agentsStillRunning.add(run.audit_input_id);
    }
  }

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
    status: normalizeStatus(r.status) === "done" && agentsStillRunning.has(r.id)
      ? "in_progress"
      : normalizeStatus(r.status),
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
    location: r.location ?? "",
    targetLocation: r.target_location ?? "",
    activity: [],
    notes: r.admin_notes ?? "",
    errorMessage: r.error_message ?? "",
  }));

  return Response.json(rows);
}
