/**
 * Notification Processor
 * Processes notification rules and sends notifications via configured channels
 */

import { prisma } from "@/lib/prisma"
import { sendNotification, replaceTemplateVariables } from "./notification-service"
import type { NotificationTrigger, NotificationChannel } from "../constants"
import { decrypt } from "@/lib/encryption"
import type { WhatsAppMetaCredentials } from "./whatsapp-meta-service"

export interface ProcessNotificationsParams {
  organizationId: string
  trigger: NotificationTrigger
  relatedEntityId?: string // leaseId, tenantId, etc.
}

export interface ProcessNotificationsResult {
  processed: number
  sent: number
  failed: number
  errors: string[]
}

/**
 * Fetch and decrypt organization API keys for notifications
 */
async function getOrganizationApiKeys(organizationId: string): Promise<{
  emailApiKey?: string
  whatsappCredentials?: WhatsAppMetaCredentials
  telegramBotToken?: string
}> {
  const apiKeys = await prisma.apiKey.findMany({
    where: {
      organizationId,
      isActive: true,
    },
  })

  const result: {
    emailApiKey?: string
    whatsappCredentials?: WhatsAppMetaCredentials
    telegramBotToken?: string
  } = {}

  for (const key of apiKeys) {
    try {
      const decryptedValue = decrypt(
        key.encryptedValue,
        key.encryptionIv,
        key.encryptionTag
      )

      if (key.service === "RESEND_EMAIL") {
        result.emailApiKey = decryptedValue
      } else if (key.service === "WHATSAPP_META") {
        result.whatsappCredentials = JSON.parse(decryptedValue)
      } else if (key.service === "TELEGRAM_BOT") {
        result.telegramBotToken = decryptedValue
      }

      // Update lastUsedAt
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
    } catch (error) {
      console.error(`Failed to decrypt API key ${key.id}:`, error)
    }
  }

  return result
}

/**
 * Process notifications for a specific trigger and organization
 */
export async function processNotifications({
  organizationId,
  trigger,
  relatedEntityId,
}: ProcessNotificationsParams): Promise<ProcessNotificationsResult> {
  const result: ProcessNotificationsResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  }

  try {
    // Fetch organization API keys
    const { emailApiKey, whatsappCredentials, telegramBotToken } =
      await getOrganizationApiKeys(organizationId)

    // Find active notification rules for this trigger
    const rules = await prisma.notificationRule.findMany({
      where: {
        organizationId,
        trigger,
        isActive: true,
      },
      include: {
        recipientUser: true,
        recipientRole: {
          include: {
            userRoles: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    })

    if (rules.length === 0) {
      return result
    }

    // Find active templates for this trigger
    const templates = await prisma.notificationTemplate.findMany({
      where: {
        organizationId,
        trigger,
        isActive: true,
      },
    })

    if (templates.length === 0) {
      return result
    }

    // Get related entity data for variable replacement
    let entityData: Record<string, unknown> | null = null
    let relatedTenantId: string | null = null
    if (relatedEntityId) {
      const fullEntityData = await getEntityData(trigger, relatedEntityId)
      if (fullEntityData) {
        entityData = fullEntityData.variables
        relatedTenantId = fullEntityData.tenantId
      }
    }

    // Process each rule
    for (const rule of rules) {
      result.processed++

      // Determine recipients based on rule type
      const recipients = await getRecipients(rule, organizationId, relatedTenantId)

      if (recipients.length === 0) {
        result.errors.push(`No recipients found for rule: ${rule.name}`)
        continue
      }

      // Send notifications for each channel and recipient
      for (const channel of rule.channels) {
        // Find matching template
        const template = templates.find((t) => t.channel === channel)

        if (!template) {
          result.errors.push(
            `No template found for trigger ${trigger} and channel ${channel}`
          )
          continue
        }

        for (const recipient of recipients) {
          // Check tenant preferences
          if (
            recipient.type === "tenant" &&
            channel === "EMAIL" &&
            !recipient.preferEmail
          ) {
            continue // Skip if tenant doesn't want emails
          }

          if (
            recipient.type === "tenant" &&
            channel === "WHATSAPP" &&
            !recipient.preferWhatsapp
          ) {
            continue // Skip if tenant doesn't want WhatsApp
          }

          if (
            recipient.type === "tenant" &&
            channel === "TELEGRAM" &&
            !recipient.preferTelegram
          ) {
            continue // Skip if tenant doesn't want Telegram
          }

          // Render template with variables
          const variables = buildVariables(entityData, recipient)
          const renderedBody = replaceTemplateVariables(template.body, variables)
          const renderedSubject = template.subject
            ? replaceTemplateVariables(template.subject, variables)
            : undefined

          // Send notification
          let recipientContact: string | undefined
          if (channel === "EMAIL") {
            recipientContact = recipient.email
          } else if (channel === "WHATSAPP" || channel === "TELEGRAM") {
            recipientContact = recipient.phone
          }

          if (!recipientContact) {
            result.errors.push(
              `No ${channel.toLowerCase()} contact for recipient: ${recipient.name}`
            )
            result.failed++
            continue
          }

          // Create notification log entry
          const log = await prisma.notificationLog.create({
            data: {
              organizationId,
              trigger,
              channel,
              recipientEmail: channel === "EMAIL" ? recipientContact : null,
              recipientPhone: channel === "WHATSAPP" || channel === "TELEGRAM" ? recipientContact : null,
              subject: renderedSubject || null,
              body: renderedBody,
              status: "PENDING",
            },
          })

          // Check if we have the required API key for this channel
          if (channel === "EMAIL" && !emailApiKey) {
            await prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: "FAILED",
                failedReason: "Organization email API key not configured",
              },
            })
            result.failed++
            result.errors.push(
              "Email API key not configured for organization"
            )
            continue
          }

          if (channel === "WHATSAPP" && !whatsappCredentials) {
            await prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: "FAILED",
                failedReason: "Organization WhatsApp credentials not configured",
              },
            })
            result.failed++
            result.errors.push(
              "WhatsApp credentials not configured for organization"
            )
            continue
          }

          if (channel === "TELEGRAM" && !telegramBotToken) {
            await prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: "FAILED",
                failedReason: "Organization Telegram bot token not configured",
              },
            })
            result.failed++
            result.errors.push(
              "Telegram bot token not configured for organization"
            )
            continue
          }

          // Send the notification
          const sendResult = await sendNotification({
            channel,
            to: recipientContact,
            subject: renderedSubject,
            body: renderedBody,
            emailApiKey,
            whatsappCredentials,
            telegramBotToken,
          })

          // Update log status
          if (sendResult.success) {
            await prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: "SENT",
                sentAt: new Date(),
              },
            })
            result.sent++
          } else {
            await prisma.notificationLog.update({
              where: { id: log.id },
              data: {
                status: "FAILED",
                failedReason: sendResult.error || "Unknown error",
              },
            })
            result.failed++
            result.errors.push(
              `Failed to send ${channel} to ${recipientContact}: ${sendResult.error}`
            )
          }
        }
      }
    }

    return result
  } catch (error) {
    console.error("Error processing notifications:", error)
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error processing notifications"
    )
    return result
  }
}

/**
 * Get entity data for variable replacement
 */
async function getEntityData(
  trigger: NotificationTrigger,
  entityId: string
): Promise<{ variables: Record<string, unknown>; tenantId: string } | null> {
  if (
    trigger === "PAYMENT_REMINDER" ||
    trigger === "PAYMENT_LATE" ||
    trigger === "PAYMENT_CONFIRMED" ||
    trigger === "LEASE_EXPIRING" ||
    trigger === "LEASE_EXPIRED"
  ) {
    // For lease-related triggers, fetch lease data
    const lease = await prisma.leaseAgreement.findUnique({
      where: { id: entityId },
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
      },
    })

    if (!lease) return null

    return {
      tenantId: lease.tenantId,
      variables: {
        tenantName: lease.tenant.fullName,
        leaseStartDate: lease.startDate.toLocaleDateString(),
        leaseEndDate: lease.endDate.toLocaleDateString(),
        rentAmount: lease.rentAmount.toString(),
        propertyName: lease.unit.property.name,
        unitName: lease.unit.name,
      },
    }
  }

  return null
}

interface Recipient {
  type: "tenant" | "user"
  name: string
  email?: string
  phone?: string
  preferEmail?: boolean
  preferWhatsapp?: boolean
  preferTelegram?: boolean
}

/**
 * Get recipients based on notification rule configuration
 */
async function getRecipients(
  rule: {
    recipientType: string
    recipientUserId: string | null
    recipientRoleId: string | null
    recipientUser?: { id: string; name: string; email: string } | null
    recipientRole?: {
      userRoles: { user: { id: string; name: string; email: string } }[]
    } | null
  },
  organizationId: string,
  relatedTenantId: string | null = null
): Promise<Recipient[]> {
  const recipients: Recipient[] = []

  if (rule.recipientType === "USER" && rule.recipientUser) {
    recipients.push({
      type: "user",
      name: rule.recipientUser.name,
      email: rule.recipientUser.email,
    })
  } else if (rule.recipientType === "ROLE" && rule.recipientRole) {
    for (const userRole of rule.recipientRole.userRoles) {
      recipients.push({
        type: "user",
        name: userRole.user.name,
        email: userRole.user.email,
      })
    }
  } else if (rule.recipientType === "TENANT") {
    // For tenant recipients, fetch the specific tenant related to the trigger
    if (!relatedTenantId) {
      // No related tenant ID, cannot send notification
      return recipients
    }

    const tenant = await prisma.tenant.findUnique({
      where: {
        id: relatedTenantId,
        organizationId, // Ensure tenant belongs to the organization
      },
      select: {
        fullName: true,
        email: true,
        phone: true,
        preferEmail: true,
        preferWhatsapp: true,
        preferTelegram: true,
      },
    })

    if (tenant) {
      recipients.push({
        type: "tenant",
        name: tenant.fullName,
        email: tenant.email || undefined,
        phone: tenant.phone || undefined,
        preferEmail: tenant.preferEmail,
        preferWhatsapp: tenant.preferWhatsapp,
        preferTelegram: tenant.preferTelegram,
      })
    }
  }

  return recipients
}

/**
 * Build template variables from entity data and recipient
 */
function buildVariables(
  entityData: Record<string, unknown> | null,
  recipient: Recipient
): Record<string, string | number> {
  const variables: Record<string, string | number> = {
    recipientName: recipient.name,
  }

  if (entityData) {
    for (const [key, value] of Object.entries(entityData)) {
      if (value !== null && value !== undefined) {
        variables[key] = String(value)
      }
    }
  }

  return variables
}

/**
 * Send a manual notification
 */
export async function sendManualNotification(params: {
  organizationId: string
  recipientEmail?: string
  recipientPhone?: string
  channel: NotificationChannel
  subject?: string
  body: string
}): Promise<{ success: boolean; error?: string }> {
  const { organizationId, recipientEmail, recipientPhone, channel, subject, body } =
    params

  let recipientContact: string | undefined
  if (channel === "EMAIL") {
    recipientContact = recipientEmail
  } else if (channel === "WHATSAPP" || channel === "TELEGRAM") {
    recipientContact = recipientPhone
  }

  if (!recipientContact) {
    return {
      success: false,
      error: `No ${channel.toLowerCase()} contact provided`,
    }
  }

  // Fetch organization API keys
  const { emailApiKey, whatsappCredentials, telegramBotToken } =
    await getOrganizationApiKeys(organizationId)

  // Check if we have the required API key for this channel
  if (channel === "EMAIL" && !emailApiKey) {
    return {
      success: false,
      error: "Organization email API key not configured",
    }
  }

  if (channel === "WHATSAPP" && !whatsappCredentials) {
    return {
      success: false,
      error: "Organization WhatsApp credentials not configured",
    }
  }

  if (channel === "TELEGRAM" && !telegramBotToken) {
    return {
      success: false,
      error: "Organization Telegram bot token not configured",
    }
  }

  // Create notification log entry
  const log = await prisma.notificationLog.create({
    data: {
      organizationId,
      trigger: "MANUAL",
      channel,
      recipientEmail: channel === "EMAIL" ? recipientContact : null,
      recipientPhone: channel === "WHATSAPP" || channel === "TELEGRAM" ? recipientContact : null,
      subject: subject || null,
      body,
      status: "PENDING",
    },
  })

  // Send the notification
  const sendResult = await sendNotification({
    channel,
    to: recipientContact,
    subject,
    body,
    emailApiKey,
    whatsappCredentials,
    telegramBotToken,
  })

  // Update log status
  if (sendResult.success) {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    })
  } else {
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        failedReason: sendResult.error || "Unknown error",
      },
    })
  }

  return sendResult
}
