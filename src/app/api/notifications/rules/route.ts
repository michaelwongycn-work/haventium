import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type {
  NotificationChannel,
  NotificationTrigger,
  NotificationRecipient,
} from "@prisma/client";
import {
  requireAccess,
  apiSuccess,
  apiCreated,
  apiError,
  handleApiError,
  validateRequest,
  parseEnumParam,
  parsePaginationParams,
  createPaginatedResponse,
} from "@/lib/api";
import { NOTIFICATION_CHANNEL, NOTIFICATION_TRIGGER } from "@/lib/constants";

const NOTIFICATION_CHANNELS = Object.values(NOTIFICATION_CHANNEL);
const NOTIFICATION_TRIGGERS = Object.values(NOTIFICATION_TRIGGER);
const NOTIFICATION_RECIPIENTS = ["TENANT", "USER", "ROLE"] as const;

const createRuleSchema = z
  .object({
    name: z.string().min(1, "Rule name is required"),
    trigger: z.enum(NOTIFICATION_TRIGGERS as [string, ...string[]]),
    daysOffset: z
      .number()
      .int()
      .min(-365)
      .max(365, "Days offset must be between -365 and 365"),
    channels: z
      .array(z.enum(NOTIFICATION_CHANNELS as [string, ...string[]]))
      .min(1, "At least one channel is required"),
    recipientType: z.enum(NOTIFICATION_RECIPIENTS).default("TENANT"),
    recipientUserId: z.string().optional().nullable(),
    recipientRoleId: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      // If recipientType is USER, recipientUserId must be provided
      if (data.recipientType === "USER" && !data.recipientUserId) {
        return false;
      }
      // If recipientType is ROLE, recipientRoleId must be provided
      if (data.recipientType === "ROLE" && !data.recipientRoleId) {
        return false;
      }
      return true;
    },
    {
      message:
        "Recipient user or role must be specified based on recipient type",
      path: ["recipientUserId"],
    },
  );

// GET /api/notifications/rules - List all notification rules
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "notifications",
      "read",
    );
    if (!authorized) return response;

    const { searchParams } = new URL(request.url);
    const trigger = parseEnumParam(
      searchParams.get("trigger"),
      NOTIFICATION_TRIGGERS,
    );
    const isActive = searchParams.get("isActive");

    const { page, limit, skip } = parsePaginationParams({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (trigger) {
      where.trigger = trigger;
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const [rules, total] = await Promise.all([
      prisma.notificationRule.findMany({
        where,
        include: {
          recipientUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          recipientRole: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip,
      }),
      prisma.notificationRule.count({ where }),
    ]);

    return apiSuccess(createPaginatedResponse(rules, page, limit, total));
  } catch (error) {
    return handleApiError(error, "fetch notification rules");
  }
}

// POST /api/notifications/rules - Create new notification rule
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "notifications",
      "create",
    );
    if (!authorized) return response;

    const validatedData = await validateRequest(request, createRuleSchema);

    // Validate recipientUserId belongs to organization if provided
    if (validatedData.recipientUserId) {
      const user = await prisma.user.findFirst({
        where: {
          id: validatedData.recipientUserId,
          organizationId: session.user.organizationId,
        },
      });

      if (!user) {
        return apiError(
          "Recipient user not found or does not belong to your organization",
          400,
        );
      }
    }

    // Validate recipientRoleId belongs to organization if provided
    if (validatedData.recipientRoleId) {
      const role = await prisma.role.findFirst({
        where: {
          id: validatedData.recipientRoleId,
          organizationId: session.user.organizationId,
        },
      });

      if (!role) {
        return apiError(
          "Recipient role not found or does not belong to your organization",
          400,
        );
      }
    }

    const rule = await prisma.notificationRule.create({
      data: {
        name: validatedData.name,
        trigger: validatedData.trigger as NotificationTrigger,
        daysOffset: validatedData.daysOffset,
        channels: validatedData.channels as NotificationChannel[],
        recipientType: validatedData.recipientType as NotificationRecipient,
        recipientUserId: validatedData.recipientUserId || null,
        recipientRoleId: validatedData.recipientRoleId || null,
        isActive: validatedData.isActive,
        organizationId: session.user.organizationId,
      },
      include: {
        recipientUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        recipientRole: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return apiCreated(rule);
  } catch (error) {
    return handleApiError(error, "create notification rule");
  }
}
