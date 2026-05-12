/**
 * Transactional email helpers — powered by Resend.
 */

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
 */
export async function sendSnapshotEmail(
  companyName: string,
  clientEmail: string,
  pdfBuffer: Uint8Array
): Promise<void> {
  const safeName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await sendEmail({
    from: `Enid <${process.env.RESEND_FROM_EMAIL ?? ""}>`,
    to: [clientEmail],
    subject: `Your Brand Snapshot is ready — ${companyName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f4f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <img src="https://enid-rho.vercel.app/Enid%20Full%20Logo%20Black.png" alt="Enid" height="36" style="display:block;height:36px;width:auto;"/>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:48px 40px;">

              <!-- Label -->
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c9a84c;">Your Snapshot is Ready</p>

              <!-- Heading -->
              <h1 style="margin:0 0 24px;font-size:28px;font-weight:700;color:#25394b;line-height:1.2;">Hi ${companyName},</h1>

              <!-- Body -->
              <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#444444;">
                Your Brand Snapshot is complete. We've analysed your brand presence across your website, social media, and competitive landscape — and distilled it into a clear, executive-ready report.
              </p>
              <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#444444;">
                Your report is attached to this email. Open it to see your Enid Score, key brand gaps, and the top actions we recommend.
              </p>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr><td style="border-top:1px solid #eeeeee;"></td></tr>
              </table>

              <!-- Attachment callout -->
              <table cellpadding="0" cellspacing="0" style="background-color:#f8f8f6;border-radius:8px;padding:16px 20px;width:100%;">
                <tr>
                  <td style="width:36px;vertical-align:middle;">
                    <div style="width:32px;height:32px;background-color:#25394b;border-radius:6px;text-align:center;line-height:32px;">
                      <span style="color:#ffffff;font-size:14px;">&#128196;</span>
                    </div>
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;">
                    <p style="margin:0;font-size:13px;font-weight:600;color:#25394b;">${companyName} Snapshot by Enid.pdf</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#888888;">Attached to this email</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:32px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;line-height:1.6;">
                This report was prepared by Enid Brand Intelligence.<br/>
                Questions? Reply to this email and we'll get back to you.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    attachments: [
      {
        filename: `${companyName} Snapshot by Enid.pdf`,
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
