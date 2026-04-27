export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

async function getDbStatus(id: string) {
  const { data, error } = await supabase()
    .from("dlb_audit_inputs")
    .select("status, error_message")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return { status: data.status, errorMessage: data.error_message };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Audit ID is required." }, { status: 400 });
  }

  // Always check the DB status so we can detect terminal states
  // even when n8n is unreachable.
  const dbStatus = await getDbStatus(id);
  const dbNormalized = (dbStatus?.status ?? "").toLowerCase();
  const dbTerminal = dbNormalized === "done" || dbNormalized === "failed";

  if (dbTerminal) {
    return Response.json({
      status: dbNormalized === "done" ? "Done" : "Failed",
      workflows: {},
      errorMessage: dbStatus?.errorMessage ?? null,
      source: "db",
    });
  }

  // DB says still in progress (or no status) — try n8n for detailed workflow info.
  const statusUrl = process.env.N8N_STATUS_CHECK_URL;
  if (!statusUrl) {
    return Response.json({
      status: "In Progress",
      workflows: {},
      errorMessage: null,
    });
  }

  try {
    const res = await fetch(statusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[audit-status] n8n status check failed: ${res.status} ${text}`);
      return Response.json({
        status: "In Progress",
        workflows: {},
        errorMessage: null,
        source: "db-fallback",
      });
    }

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      console.warn(`[audit-status] n8n returned non-JSON response: ${text.slice(0, 200)}`);
      return Response.json({ status: "In Progress", workflows: {}, errorMessage: null });
    }

    if (!data) {
      return Response.json({ status: "In Progress", workflows: {}, errorMessage: null });
    }

    return Response.json({
      ...data,
      errorMessage: dbStatus?.errorMessage ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status check failed.";
    console.error("[audit-status] Error:", msg);
    // n8n unreachable — fall back to DB status
    return Response.json({
      status: "In Progress",
      workflows: {},
      errorMessage: null,
      source: "db-fallback",
    });
  }
}
