/**
 * Notification Service
 * Handles email, WhatsApp, and Telegram sending with organization-specific API keys
 */

import { Resend } from "resend"
import { logger } from "@/lib/logger"
import { NotificationChannel } from "../constants"
import { replaceTemplateVariables } from "./template-utils"
import {
  sendWhatsAppMeta,
  type WhatsAppMetaCredentials,
  type SendWhatsAppMetaParams,
} from "./whatsapp-meta-service"
import {
  sendTelegramMessage,
  type SendTelegramParams,
} from "./telegram-service"

export interface SendEmailParams {
  to: string
  subject: string
  body: string
  from?: string
  apiKey: string // Required: organization's Resend API key
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an email via Resend using organization's API key
 * @param apiKey - Organization's Resend API key (required)
 */
export async function sendEmail({
  to,
  subject,
  body,
  from = `Haventium <noreply@haventium.com>`,
  apiKey,
}: SendEmailParams): Promise<SendEmailResult> {
  if (!apiKey) {
    logger.error("Resend API key not provided for email notification")
    return {
      success: false,
      error: "Organization API key not configured for email",
    }
  }

  try {
    const resend = new Resend(apiKey)

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html: body,
    })

    if (error) {
      logger.error("Resend API error", error, { recipient: to })
      return { success: false, error: error.message }
    }

    return {
      success: true,
      messageId: data?.id,
    }
  } catch (error) {
    logger.error("Resend API error", error, { recipient: to })
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export interface SendWhatsAppParams extends SendWhatsAppMetaParams {
  credentials: WhatsAppMetaCredentials // Required: organization's WhatsApp credentials
}

export interface SendWhatsAppResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a WhatsApp message via Meta Cloud API
 * @param credentials - Organization's WhatsApp Meta credentials (required)
 */
export async function sendWhatsApp(
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  if (!params.credentials) {
    return {
      success: false,
      error: "Organization API key not configured for WhatsApp",
    }
  }

  return sendWhatsAppMeta(params, params.credentials)
}

export interface SendTelegramResult {
  success: boolean
  messageId?: number
  error?: string
}

/**
 * Send a Telegram message via Bot API
 * @param botToken - Organization's Telegram bot token (required)
 */
export async function sendTelegram(params: {
  to: string
  body: string
  botToken: string
}): Promise<SendTelegramResult> {
  if (!params.botToken) {
    return {
      success: false,
      error: "Organization API key not configured for Telegram",
    }
  }

  const telegramParams: SendTelegramParams = {
    chatId: params.to,
    text: params.body,
    parseMode: "HTML",
  }

  return sendTelegramMessage(telegramParams, params.botToken)
}

/**
 * Send a notification via the specified channel
 * @param emailApiKey - Required for email notifications
 * @param whatsappCredentials - Required for WhatsApp notifications
 * @param telegramBotToken - Required for Telegram notifications
 */
export async function sendNotification(params: {
  channel: NotificationChannel
  to: string
  subject?: string
  body: string
  emailApiKey?: string
  whatsappCredentials?: WhatsAppMetaCredentials
  telegramBotToken?: string
  templateName?: string
  templateLanguage?: string
  templateParams?: string[]
}): Promise<{ success: boolean; messageId?: string | number; error?: string }> {
  const {
    channel,
    to,
    subject,
    body,
    emailApiKey,
    whatsappCredentials,
    telegramBotToken,
    templateName,
    templateLanguage,
    templateParams,
  } = params

  if (channel === "EMAIL") {
    if (!subject) {
      return {
        success: false,
        error: "Subject is required for email notifications",
      }
    }
    if (!emailApiKey) {
      return {
        success: false,
        error: "Organization email API key not configured",
      }
    }
    return sendEmail({ to, subject, body, apiKey: emailApiKey })
  }

  if (channel === "WHATSAPP") {
    if (!whatsappCredentials) {
      return {
        success: false,
        error: "Organization WhatsApp credentials not configured",
      }
    }
    return sendWhatsApp({
      to,
      body,
      templateName,
      templateLanguage,
      templateParams,
      credentials: whatsappCredentials,
    })
  }

  if (channel === "TELEGRAM") {
    if (!telegramBotToken) {
      return {
        success: false,
        error: "Organization Telegram bot token not configured",
      }
    }
    return sendTelegram({
      to,
      body,
      botToken: telegramBotToken,
    })
  }

  return {
    success: false,
    error: `Unsupported notification channel: ${channel}`,
  }
}

export { replaceTemplateVariables }
