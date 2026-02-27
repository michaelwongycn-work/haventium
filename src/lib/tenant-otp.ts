import crypto from "crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";

export const OTP_EXPIRY_MINUTES = 10;

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export function generateOtp(): string {
  const bytes = crypto.randomBytes(3);
  const num = ((bytes[0] << 16) | (bytes[1] << 8) | bytes[2]) % 1000000;
  return num.toString().padStart(6, "0");
}

/**
 * Hash an OTP with SHA-256 for storage
 */
export function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Send OTP via email using org's MailerSend API key (falls back to platform key)
 */
export async function sendOtpEmail({
  organizationId,
  orgName,
  to,
  toName,
  otp,
}: {
  organizationId: string;
  orgName: string;
  to: string;
  toName: string;
  otp: string;
}): Promise<void> {
  // Try org's own Resend key first, fall back to platform key
  let apiKey = process.env.RESEND_API_KEY!;
  try {
    const orgKey = await prisma.apiKey.findUnique({
      where: {
        organizationId_service: {
          organizationId,
          service: "RESEND_EMAIL",
        },
      },
    });
    if (orgKey?.isActive) {
      apiKey = decrypt(
        orgKey.encryptedValue,
        orgKey.encryptionIv,
        orgKey.encryptionTag,
      );
    }
  } catch {
    // Fall back to platform key silently
  }

  const resend = new Resend(apiKey);
  const from = `${process.env.RESEND_FROM_NAME ?? "Haventium"} <${process.env.RESEND_FROM_EMAIL!}>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Login Code</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:20px;font-weight:700;color:#09090b;letter-spacing:-0.5px;">${orgName}</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;line-height:1.3;">
                Your login code
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#71717a;line-height:1.6;">
                Hi <strong style="color:#09090b;">${toName}</strong>, use the code below to log in to your tenant portal.
              </p>
              <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                <span style="font-size:40px;font-weight:700;color:#09090b;letter-spacing:8px;">${otp}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#71717a;">
                This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
                If you did not request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Tenant portal for ${orgName} — powered by Haventium
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from,
    to,
    subject: `${otp} — Your login code for ${orgName}`,
    html,
    text: `Hi ${toName},\n\nYour login code for ${orgName} tenant portal: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
  });
}

/**
 * Send OTP via WhatsApp using org's Meta Cloud API credentials
 */
export async function sendOtpWhatsApp({
  organizationId,
  phone,
  orgName,
  otp,
}: {
  organizationId: string;
  phone: string;
  orgName: string;
  otp: string;
}): Promise<void> {
  const orgKey = await prisma.apiKey.findUnique({
    where: {
      organizationId_service: {
        organizationId,
        service: "WHATSAPP_META",
      },
    },
  });

  if (!orgKey?.isActive) {
    throw new Error("WhatsApp not configured for this organization");
  }

  const credentialsJson = decrypt(
    orgKey.encryptedValue,
    orgKey.encryptionIv,
    orgKey.encryptionTag,
  );
  const credentials = JSON.parse(credentialsJson) as {
    phoneNumberId: string;
    accessToken: string;
  };

  // Normalize phone: strip non-digits, ensure starts with country code
  const normalizedPhone = phone.replace(/\D/g, "");

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${credentials.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizedPhone,
        type: "text",
        text: {
          body: `Your login code for ${orgName} tenant portal: *${otp}*\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error("WhatsApp OTP send failed", { error, phone: normalizedPhone });
    throw new Error(`WhatsApp send failed: ${response.status}`);
  }
}
