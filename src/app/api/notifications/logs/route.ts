import { prisma } from "@/lib/prisma"
import {
  requireAccess,
  apiSuccess,
  handleApiError,
  parseEnumParam,
} from "@/lib/api"
import { NOTIFICATION_CHANNEL, NOTIFICATION_TRIGGER, NOTIFICATION_STATUS } from "@/lib/constants"

const NOTIFICATION_CHANNELS = Object.values(NOTIFICATION_CHANNEL)
const NOTIFICATION_TRIGGERS = Object.values(NOTIFICATION_TRIGGER)
const NOTIFICATION_STATUSES = Object.values(NOTIFICATION_STATUS)

// GET /api/notifications/logs - List all notification logs with filtering
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "read")
    if (!authorized) return response

    const { searchParams } = new URL(request.url)
    const trigger = parseEnumParam(searchParams.get("trigger"), NOTIFICATION_TRIGGERS)
    const channel = parseEnumParam(searchParams.get("channel"), NOTIFICATION_CHANNELS)
    const status = parseEnumParam(searchParams.get("status"), NOTIFICATION_STATUSES)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100) // Max 100 per page

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    }

    if (trigger) {
      where.trigger = trigger
    }

    if (channel) {
      where.channel = channel
    }

    if (status) {
      where.status = status
    }

    // Get total count for pagination
    const total = await prisma.notificationLog.count({ where })

    const logs = await prisma.notificationLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
    })

    return apiSuccess({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error, "fetch notification logs")
  }
}
