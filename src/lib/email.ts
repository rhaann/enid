/**
 * Transactional email helpers — powered by Resend.
 */

// ---------------------------------------------------------------------------
// Core send function
// ---------------------------------------------------------------------------

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
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
  downloadUrl: string
): Promise<void> {
  await sendEmail({
    from: `Enid <${process.env.RESEND_FROM_EMAIL ?? ""}>`,
    to: [clientEmail],
    subject: `Your Snapshot by Enid is Ready!`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0;padding:40px 24px;">
    <tr>
      <td>

        <!-- Greeting -->
        <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#222222;">Hi ${companyName},</p>

        <!-- Body -->
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#222222;">
          Your Brand Snapshot is complete. We've analysed your branding, website, social media, and distilled it into a clear, executive-ready report.
        </p>
        <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#222222;">
          Open it to see your Enid Score, key brand gaps, and the top actions we recommend.
        </p>

        <!-- Inline PDF attachment -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td style="border-radius:10px;background-color:#4BBEC6;">
              <a href="${downloadUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.2px;">
                ${companyName}-snapshot.pdf
              </a>
            </td>
          </tr>
        </table>

        <!-- Sign-off -->
        <p style="margin:0 0 12px;font-size:16px;line-height:1.7;color:#222222;">Best,</p>
        <img src="https://enid-rho.vercel.app/Enid%20Full%20Logo%20Black.png" alt="Enid" height="28" style="display:block;height:28px;width:auto;margin-bottom:6px;"/>
        <a href="https://www.askenid.ai/" style="font-size:13px;color:#888888;text-decoration:none;">askenid.ai</a>

      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });
}

/**
 * Sends a failure notification to both admin addresses.
 */
export async function sendAdminFailureAlert(
  companyName: string,
  companyUrl: string,
  clientEmail: string,
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
      <p><strong>Client Email:</strong> <a href="mailto:${clientEmail}">${clientEmail}</a></p>
      <hr/>
      <p><strong>Error:</strong></p>
      <pre style="background:#f5f5f5;padding:12px;border-radius:4px;font-size:13px;">${errorMessage}</pre>
    `,
  });
}
