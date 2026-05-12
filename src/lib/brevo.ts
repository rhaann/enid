/**
 * Brevo transactional email helpers.
 *
 * In testing mode all emails are routed to the admin address regardless of
 * the intended recipient. Swap TEST_RECIPIENT for `to` once live.
 */

// ---------------------------------------------------------------------------
// Testing override — all emails go here until we go live
// ---------------------------------------------------------------------------
const TEST_RECIPIENT = "ruj@actualinsight.com";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface BrevoRecipient {
  email: string;
  name?: string;
}

interface BrevoAttachment {
  /** Filename shown in the email client. */
  name: string;
  /** Base64-encoded file content. */
  content: string;
}

interface BrevoPayload {
  sender: BrevoRecipient;
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  attachment?: BrevoAttachment[];
}

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

async function sendBrevoEmail(payload: BrevoPayload): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY ?? "",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Brevo API error (HTTP ${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

/**
 * Sends the completed Brand Snapshot PDF to the client.
 * Currently routes to TEST_RECIPIENT instead of the real client email.
 *
 * @param companyName - Used in the subject line and attachment filename.
 * @param pdfBuffer   - Raw PDF bytes from the snapshot agent.
 */
export async function sendSnapshotEmail(
  companyName: string,
  pdfBuffer: Uint8Array
): Promise<void> {
  const safeName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await sendBrevoEmail({
    sender: {
      email: process.env.BREVO_SENDER_EMAIL ?? "",
      name: "Enid",
    },
    to: [{ email: TEST_RECIPIENT }],
    subject: `Your Brand Snapshot — ${companyName}`,
    htmlContent: `
      <p>Hi,</p>
      <p>Your Brand Snapshot for <strong>${companyName}</strong> is ready.</p>
      <p>Please find your report attached.</p>
      <p>— The Enid Team</p>
    `,
    attachment: [
      {
        name: `enid-snapshot-${safeName}.pdf`,
        content: Buffer.from(pdfBuffer).toString("base64"),
      },
    ],
  });
}

/**
 * Sends a failure notification to both admin addresses.
 *
 * @param companyName  - Name of the company whose audit failed.
 * @param companyUrl   - Website URL for context.
 * @param errorMessage - The error that caused the failure.
 */
export async function sendAdminFailureAlert(
  companyName: string,
  companyUrl: string,
  errorMessage: string
): Promise<void> {
  const adminEmails: BrevoRecipient[] = [
    process.env.ADMIN_EMAIL_1,
    process.env.ADMIN_EMAIL_2,
  ]
    .filter(Boolean)
    .map((email) => ({ email: email as string }));

  if (adminEmails.length === 0) {
    console.warn("[brevo] No admin emails configured — skipping failure alert.");
    return;
  }

  await sendBrevoEmail({
    sender: {
      email: process.env.BREVO_SENDER_EMAIL ?? "",
      name: "Enid",
    },
    to: adminEmails,
    subject: `Audit Failed — ${companyName}`,
    htmlContent: `
      <h2 style="color:#c0392b;">Audit Failed</h2>
      <p><strong>Company:</strong> ${companyName}</p>
      <p><strong>Website:</strong> <a href="${companyUrl}">${companyUrl}</a></p>
      <hr/>
      <p><strong>Error:</strong></p>
      <pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:13px;">${errorMessage}</pre>
    `,
  });
}
