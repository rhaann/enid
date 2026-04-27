export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_ASSETS_PER_AUDIT = 10;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
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

/** GET /api/assets?audit_input_id=<uuid> */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const auditInputId = searchParams.get("audit_input_id");
  if (!auditInputId) {
    return Response.json({ error: "audit_input_id is required." }, { status: 400 });
  }

  const { data, error } = await supabase()
    .from("assets")
    .select("id, file_name, file_type, file_size_bytes, storage_path, created_at")
    .eq("audit_input_id", auditInputId)
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: "Failed to fetch assets." }, { status: 500 });
  }

  const assets = (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.file_name ?? "Unnamed",
    type: mimeToLabel(r.file_type ?? ""),
    size: formatBytes(r.file_size_bytes ?? 0),
    storagePath: r.storage_path,
    createdAt: r.created_at,
  }));

  return Response.json(assets);
}

/** POST /api/assets — multipart upload */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await req.formData();
  const auditInputId = formData.get("audit_input_id") as string | null;
  const file = formData.get("file") as File | null;

  if (!auditInputId) {
    return Response.json({ error: "audit_input_id is required." }, { status: 400 });
  }
  if (!file) {
    return Response.json({ error: "file is required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: `File type "${file.type}" is not allowed.` }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File exceeds 25 MB limit." }, { status: 400 });
  }

  const { count, error: countErr } = await supabase()
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("audit_input_id", auditInputId);

  if (!countErr && (count ?? 0) >= MAX_ASSETS_PER_AUDIT) {
    return Response.json({ error: `Maximum ${MAX_ASSETS_PER_AUDIT} assets per audit.` }, { status: 400 });
  }

  const timestamp = Date.now();
  const safeName = sanitizeFilename(file.name);
  const storagePath = `${auditInputId}/${timestamp}_${safeName}`;

  const arrayBuf = await file.arrayBuffer();
  const { error: uploadError } = await supabase()
    .storage
    .from("brand-assets")
    .upload(storagePath, arrayBuf, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return Response.json({ error: "Failed to upload file to storage." }, { status: 500 });
  }

  const { data: inserted, error: dbError } = await supabase()
    .from("assets")
    .insert({
      audit_input_id: auditInputId,
      file_name: file.name,
      file_type: file.type,
      file_size_bytes: file.size,
      storage_path: storagePath,
    })
    .select("id, file_name, file_type, file_size_bytes, storage_path, created_at")
    .single();

  if (dbError || !inserted) {
    return Response.json({ error: "File uploaded but failed to save metadata." }, { status: 500 });
  }

  return Response.json({
    id: inserted.id,
    name: inserted.file_name,
    type: mimeToLabel(inserted.file_type ?? ""),
    size: formatBytes(inserted.file_size_bytes ?? 0),
    storagePath: inserted.storage_path,
    createdAt: inserted.created_at,
  });
}

/** DELETE /api/assets?id=<asset_uuid> */
export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("id");
  if (!assetId) {
    return Response.json({ error: "id is required." }, { status: 400 });
  }

  const { data: asset, error: fetchErr } = await supabase()
    .from("assets")
    .select("id, storage_path")
    .eq("id", assetId)
    .maybeSingle();

  if (fetchErr || !asset) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  if (asset.storage_path) {
    await supabase()
      .storage
      .from("brand-assets")
      .remove([asset.storage_path]);
  }

  const { error: deleteErr } = await supabase()
    .from("assets")
    .delete()
    .eq("id", assetId);

  if (deleteErr) {
    return Response.json({ error: "Failed to delete asset record." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
