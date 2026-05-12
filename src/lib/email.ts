/**
 * Transactional email helpers — powered by Resend.
 *
 * In testing mode all emails are routed to the admin address regardless of
 * the intended recipient. Swap TEST_RECIPIENT for `to` once live.
 */

// ---------------------------------------------------------------------------
// Testing override — all emails go here until we go live
// ---------------------------------------------------------------------------
const TEST_RECIPIENT = "ruj@actualinsight.com";

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

interface ResendAttachment {
  filename: string;
  content: string; // base64
}

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: ResendAttachment[];
}

async function sendEmail(payload: ResendPayload): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.RESEND_API_KEY ?? ""}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error (HTTP ${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Sends the completed Brand Snapshot PDF to the client.
 * Currently routes to TEST_RECIPIENT instead of the real client email.
 */
export async function sendSnapshotEmail(
  companyName: string,
  pdfBuffer: Uint8Array
): Promise<void> {
  const safeName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await sendEmail({
    from: `Enid <${process.env.RESEND_FROM_EMAIL ?? ""}>`,
    to: [TEST_RECIPIENT],
    subject: `Your Brand Snapshot — ${companyName}`,
    html: `
      <p>Hi,</p>
      <p>Your Brand Snapshot for <strong>${companyName}</strong> is ready.</p>
      <p>Please find your report attached.</p>
      <p>— The Enid Team</p>
    `,
    attachments: [
      {
        filename: `enid-snapshot-${safeName}.pdf`,
        content: Buffer.from(pdfBuffer).toString("base64"),
      },
    ],
  });
}

/**
 * Sends a failure notification to both admin addresses.
 */
export async function sendAdminFailureAlert(
  companyName: string,
  companyUrl: string,
  errorMessage: string
): Promise<void> {
  const adminEmails = [
    process.env.ADMIN_EMAIL_1,
    process.env.ADMIN_EMAIL_2,
  ].filter(Boolean) as string[];

  if (adminEmails.length === 0) {
    console.warn("[email] No admin emails configured — skipping failure alert.");
    return;
  }

  await sendEmail({
    from: `Enid <${process.env.RESEND_FROM_EMAIL ?? ""}>`,
    to: adminEmails,
    subject: `Audit Failed — ${companyName}`,
    html: `
      <h2 style="color:#c0392b;">Audit Failed</h2>
      <p><strong>Company:</strong> ${companyName}</p>
      <p><strong>Website:</strong> <a href="${companyUrl}">${companyUrl}</a></p>
      <hr/>
      <p><strong>Error:</strong></p>
      <pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:13px;">${errorMessage}</pre>
    `,
  });
}
