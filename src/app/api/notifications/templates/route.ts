import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { NotificationChannel, NotificationTrigger } from "@prisma/client"
import {
  requireAccess,
  apiSuccess,
  apiCreated,
  apiError,
  handleApiError,
  validateRequest,
  parseEnumParam,
} from "@/lib/api"
import { NOTIFICATION_CHANNEL, NOTIFICATION_TRIGGER } from "@/lib/constants"

const NOTIFICATION_CHANNELS = Object.values(NOTIFICATION_CHANNEL)
const NOTIFICATION_TRIGGERS = Object.values(NOTIFICATION_TRIGGER)

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  trigger: z.enum(NOTIFICATION_TRIGGERS as [string, ...string[]]),
  channel: z.enum(NOTIFICATION_CHANNELS as [string, ...string[]]),
  subject: z.string().optional(),
  body: z.string().min(1, "Template body is required"),
  isActive: z.boolean().default(true),
}).refine((data) => {
  // Email notifications require a subject
  if (data.channel === "EMAIL" && !data.subject) {
    return false
  }
  return true
}, {
  message: "Subject is required for email notifications",
  path: ["subject"],
})

// GET /api/notifications/templates - List all notification templates
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "read")
    if (!authorized) return response

    const { searchParams } = new URL(request.url)
    const trigger = parseEnumParam(searchParams.get("trigger"), NOTIFICATION_TRIGGERS)
    const channel = parseEnumParam(searchParams.get("channel"), NOTIFICATION_CHANNELS)
    const isActive = searchParams.get("isActive")

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    }

    if (trigger) {
      where.trigger = trigger
    }

    if (channel) {
      where.channel = channel
    }

    if (isActive !== null) {
      where.isActive = isActive === "true"
    }

    const templates = await prisma.notificationTemplate.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    })

    return apiSuccess(templates)
  } catch (error) {
    return handleApiError(error, "fetch notification templates")
  }
}

// POST /api/notifications/templates - Create new notification template
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "create")
    if (!authorized) return response

    const validatedData = await validateRequest(request, createTemplateSchema)

    // Check for duplicate template (same trigger + channel + name)
    const existingTemplate = await prisma.notificationTemplate.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: validatedData.name,
        trigger: validatedData.trigger as NotificationTrigger,
        channel: validatedData.channel as NotificationChannel,
      },
    })

    if (existingTemplate) {
      return apiError(
        "A template with this name, trigger, and channel already exists",
        400
      )
    }

    const template = await prisma.notificationTemplate.create({
      data: {
        name: validatedData.name,
        trigger: validatedData.trigger as NotificationTrigger,
        channel: validatedData.channel as NotificationChannel,
        subject: validatedData.subject || null,
        body: validatedData.body,
        isActive: validatedData.isActive,
        organizationId: session.user.organizationId,
      },
    })

    return apiCreated(template)
  } catch (error) {
    return handleApiError(error, "create notification template")
  }
}
