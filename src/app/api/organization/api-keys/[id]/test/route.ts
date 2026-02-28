import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  requireFeature,
  apiSuccess,
  apiError,
  handleApiError,
  validateRequest,
} from "@/lib/api";
import { decrypt } from "@/lib/encryption";

const testApiKeySchema = z.object({
  service: z.enum(["RESEND_EMAIL", "WHATSAPP_META", "TELEGRAM_BOT", "XENDIT"]),
  value: z.string().min(1, "API key value is required").optional(),
});

/**
 * POST /api/settings/api-keys/[id]/test - Test API key connection
 * Tests either a new API key value (if provided) or an existing stored key
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const { allowed, response: featureResponse } = await requireFeature(session.user.organizationId, "PAYMENT_GATEWAY");
    if (!allowed) return featureResponse;

    const { id } = await params;
    const validatedData = await validateRequest(request, testApiKeySchema);

    let apiKeyValue = validatedData.value;

    // If no value provided, fetch and decrypt the stored key
    if (!apiKeyValue) {
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id,
          organizationId: session.user.organizationId,
        },
      });

      if (!apiKey) {
        return apiError("API key not found", 404);
      }

      apiKeyValue = decrypt(
        apiKey.encryptedValue,
        apiKey.encryptionIv,
        apiKey.encryptionTag,
      );
    }

    // Test the API key based on service type
    let testResult: { success: boolean; message: string; error?: string };

    switch (validatedData.service) {
      case "RESEND_EMAIL":
        testResult = await testResendKey(apiKeyValue);
        break;

      case "WHATSAPP_META":
        testResult = await testWhatsAppKey(apiKeyValue);
        break;

      case "TELEGRAM_BOT":
        testResult = await testTelegramKey(apiKeyValue);
        break;

      case "XENDIT":
        testResult = await testXenditKey(apiKeyValue);
        break;

      default:
        return apiError("Unsupported service type", 400);
    }

    // Update lastUsedAt if testing an existing key (no value was provided by client)
    if (!validatedData.value) {
      await prisma.apiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    }

    if (testResult.success) {
      return apiSuccess({
        success: true,
        message: testResult.message,
      });
    } else {
      return apiError(testResult.message, 400);
    }
  } catch (error) {
    return handleApiError(error, "test API key");
  }
}

/**
 * Test Resend API key by calling their API
 */
async function testResendKey(
  apiKey: string,
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return {
        success: true,
        message: "Resend API key is valid",
      };
    } else {
      const data = await response.json();
      return {
        success: false,
        message: "Invalid Resend API key",
        error: data.message || "Authentication failed",
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to test Resend API key",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test WhatsApp Meta API credentials
 * Expected format: JSON with { accessToken, phoneNumberId, businessAccountId }
 */
async function testWhatsAppKey(
  apiKey: string,
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const credentials = JSON.parse(apiKey);

    if (
      !credentials.accessToken ||
      !credentials.phoneNumberId ||
      !credentials.businessAccountId
    ) {
      return {
        success: false,
        message:
          "Invalid WhatsApp credentials format. Expected JSON with accessToken, phoneNumberId, and businessAccountId",
      };
    }

    // Test by fetching phone number info from WhatsApp API
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `WhatsApp API credentials are valid (Phone: ${data.display_phone_number || "N/A"})`,
      };
    } else {
      const data = await response.json();
      return {
        success: false,
        message: "Invalid WhatsApp API credentials",
        error: data.error?.message || "Authentication failed",
      };
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        message:
          "Invalid JSON format. WhatsApp credentials must be valid JSON with accessToken, phoneNumberId, and businessAccountId",
      };
    }
    return {
      success: false,
      message: "Failed to test WhatsApp API credentials",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Telegram Bot token by calling the getMe API
 */
async function testTelegramKey(
  botToken: string,
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // Call Telegram Bot API getMe method to verify the token
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
      {
        method: "GET",
      },
    );

    const data = await response.json();

    if (data.ok && data.result) {
      return {
        success: true,
        message: `Telegram bot token is valid (Bot: @${data.result.username || "unknown"})`,
      };
    } else {
      return {
        success: false,
        message: "Invalid Telegram bot token",
        error: data.description || "Authentication failed",
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to test Telegram bot token",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test Xendit API key by calling the balance endpoint
 */
async function testXenditKey(
  apiKey: string,
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    // Value may be stored as JSON {"secretKey":"...","webhookToken":"..."}
    let secretKey = apiKey;
    try {
      const parsed = JSON.parse(apiKey);
      if (parsed?.secretKey) secretKey = parsed.secretKey;
    } catch {
      // plain key string
    }

    const response = await fetch("https://api.xendit.co/balance", {
      method: "GET",
      headers: {
        Authorization:
          "Basic " + Buffer.from(secretKey + ":").toString("base64"),
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `Xendit API key is valid (Balance: ${data.balance ?? "N/A"} ${data.currency ?? ""})`.trim(),
      };
    } else {
      const data = await response.json().catch(() => ({}));
      const detail = data.message || data.error_code || `HTTP ${response.status}`;
      return {
        success: false,
        message: `Xendit authentication failed: ${detail}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: "Failed to test Xendit API key",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
