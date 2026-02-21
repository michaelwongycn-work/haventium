import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

export async function sendVerificationEmail({
  to,
  toName,
  token,
  baseUrl,
}: {
  to: string;
  toName: string;
  token: string;
  baseUrl: string;
}) {
  const mailerSend = new MailerSend({
    apiKey: process.env.MAILERSEND_API_KEY!,
  });

  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifikasi Email</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:20px;font-weight:700;color:#09090b;letter-spacing:-0.5px;">Haventium</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;padding:40px 36px;">

              <!-- Heading -->
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;line-height:1.3;">
                Verifikasi email kamu
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#71717a;line-height:1.6;">
                Halo <strong style="color:#09090b;">${toName}</strong>, terima kasih sudah daftar di Haventium.
                Klik tombol di bawah untuk mengaktifkan akun kamu.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="background:#09090b;border-radius:10px;">
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.1px;">
                      Verifikasi Email
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-top:1px solid #e4e4e7;"></td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 6px;font-size:13px;color:#71717a;">
                Jika tombol di atas tidak berfungsi, salin link berikut ke browser:
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;word-break:break-all;">
                ${verifyUrl}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Link ini berlaku selama <strong>24 jam</strong>.
                Jika kamu tidak mendaftar di Haventium, abaikan email ini.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const emailParams = new EmailParams()
    .setFrom(
      new Sender(
        process.env.MAILERSEND_FROM_EMAIL!,
        process.env.MAILERSEND_FROM_NAME ?? "Haventium",
      ),
    )
    .setTo([new Recipient(to, toName)])
    .setSubject("Verifikasi email kamu — Haventium")
    .setHtml(html)
    .setText(`Halo ${toName},\n\nVerifikasi email kamu dengan membuka link berikut:\n${verifyUrl}\n\nLink berlaku 24 jam. Jika kamu tidak mendaftar di Haventium, abaikan email ini.`);

  await mailerSend.email.send(emailParams);
}
