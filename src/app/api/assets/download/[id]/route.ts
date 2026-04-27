export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/supabase/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Asset ID is required." }, { status: 400 });
  }

  const { data: asset, error } = await supabase()
    .from("assets")
    .select("storage_path, file_name")
    .eq("id", id)
    .maybeSingle();

  if (error || !asset || !asset.storage_path) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase()
    .storage
    .from("brand-assets")
    .createSignedUrl(asset.storage_path, 120, {
      download: asset.file_name || true,
    });

  if (signError || !signed?.signedUrl) {
    return Response.json({ error: "Failed to generate download link." }, { status: 500 });
  }

  return Response.redirect(signed.signedUrl, 302);
}
