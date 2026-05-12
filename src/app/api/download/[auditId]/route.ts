/**
 * GET /api/download/[auditId]
 *
 * Public route — generates and streams the Brand Snapshot PDF for a given
 * audit. Proxies to the snapshot_agent using the internal secret so no
 * admin session is required. Used as the download link in client emails.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ auditId: string }> }
) {
  const { auditId } = await params;

  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const appUrl = `${proto}://${host}`;

  const snapshotRes = await fetch(`${appUrl}/api/snapshot_agent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
    },
    body: JSON.stringify({ audit_input_id: auditId }),
  });

  if (!snapshotRes.ok) {
    const json = await snapshotRes.json().catch(() => ({})) as { error?: string };
    return Response.json(
      { error: json.error ?? `Snapshot agent returned HTTP ${snapshotRes.status}` },
      { status: snapshotRes.status }
    );
  }

  const contentType = snapshotRes.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    return Response.json({ error: "Unexpected response from snapshot agent." }, { status: 502 });
  }

  const pdfBuffer = await snapshotRes.arrayBuffer();
  const disposition = snapshotRes.headers.get("content-disposition") ?? 'attachment; filename="snapshot.pdf"';

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": disposition,
    },
  });
}
