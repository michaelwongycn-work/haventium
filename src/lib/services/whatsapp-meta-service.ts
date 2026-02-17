/**
 * WhatsApp Meta Cloud API Service
 * Direct integration with Meta's WhatsApp Business API
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

export interface WhatsAppMetaCredentials {
  accessToken: string // Long-lived access token from Meta Business
  phoneNumberId: string // WhatsApp Business Phone Number ID
  businessAccountId?: string // Optional: for verification
}

export interface SendWhatsAppMetaParams {
  to: string // Phone number in international format (e.g., +1234567890)
  body: string // Message text (for plain messages)
  templateName?: string // Template name (for marketing/utility messages)
  templateLanguage?: string // Template language code (e.g., "en_US")
  templateParams?: string[] // Template variable values
}

export interface WhatsAppMetaResponse {
  success: boolean
  messageId?: string
  error?: string
  details?: unknown
}

const GRAPH_API_VERSION = "v21.0"
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

/**
 * Send a WhatsApp message via Meta Cloud API
 */
export async function sendWhatsAppMeta(
  params: SendWhatsAppMetaParams,
  credentials: WhatsAppMetaCredentials
): Promise<WhatsAppMetaResponse> {
  const { accessToken, phoneNumberId } = credentials

  if (!accessToken || !phoneNumberId) {
    return {
      success: false,
      error: "Missing WhatsApp credentials (accessToken or phoneNumberId)",
    }
  }

  // Validate phone number format
  if (!params.to.startsWith("+")) {
    return {
      success: false,
      error: "Phone number must be in international format (e.g., +1234567890)",
    }
  }

  try {
    // Build message payload based on type
    let messagePayload: unknown

    if (params.templateName) {
      // Template message (for marketing/utility)
      messagePayload = {
        messaging_product: "whatsapp",
        to: params.to.replace(/\+/g, ""), // Remove + for API
        type: "template",
        template: {
          name: params.templateName,
          language: {
            code: params.templateLanguage || "en_US",
          },
          components: params.templateParams
            ? [
                {
                  type: "body",
                  parameters: params.templateParams.map((value) => ({
                    type: "text",
                    text: value,
                  })),
                },
              ]
            : [],
        },
      }
    } else {
      // Plain text message (for service messages within 72h window)
      messagePayload = {
        messaging_product: "whatsapp",
        to: params.to.replace(/\+/g, ""), // Remove + for API
        type: "text",
        text: {
          body: params.body,
        },
      }
    }

    const response = await fetch(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      // Handle Meta API errors
      const errorMessage =
        data.error?.message || `WhatsApp API error: ${response.status}`
      return {
        success: false,
        error: errorMessage,
        details: data.error,
      }
    }

    // Success response
    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      details: data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Verify WhatsApp credentials by fetching phone number info
 */
export async function verifyWhatsAppMetaCredentials(
  credentials: WhatsAppMetaCredentials
): Promise<{
  success: boolean
  phoneNumber?: string
  verifiedName?: string
  error?: string
}> {
  const { accessToken, phoneNumberId } = credentials

  if (!accessToken || !phoneNumberId) {
    return {
      success: false,
      error: "Missing WhatsApp credentials",
    }
  }

  try {
    const response = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const data = await response.json()
      return {
        success: false,
        error: data.error?.message || "Failed to verify credentials",
      }
    }

    const data = await response.json()
    return {
      success: true,
      phoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    }
  }
}
