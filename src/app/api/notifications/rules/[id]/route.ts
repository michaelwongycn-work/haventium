import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAccess } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import { NOTIFICATION_CHANNEL, NOTIFICATION_TRIGGER } from "@/lib/constants"

const NOTIFICATION_CHANNELS = Object.values(NOTIFICATION_CHANNEL)
const NOTIFICATION_TRIGGERS = Object.values(NOTIFICATION_TRIGGER)
const NOTIFICATION_RECIPIENTS = ["TENANT", "USER", "ROLE"] as const

const updateRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").optional(),
  trigger: z.enum(NOTIFICATION_TRIGGERS as [string, ...string[]]).optional(),
  daysOffset: z.number().int().min(-365).max(365).optional(),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS as [string, ...string[]])).min(1).optional(),
  recipientType: z.enum(NOTIFICATION_RECIPIENTS).optional(),
  recipientUserId: z.string().optional().nullable(),
  recipientRoleId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

// GET /api/notifications/rules/[id] - Get single notification rule
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "read")
    if (!authorized) return response

    const { id } = await params

    const rule = await prisma.notificationRule.findFirst({
      where: {
        id,
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
    })

    if (!rule) {
      return NextResponse.json(
        { error: "Notification rule not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error("Error fetching notification rule:", error)
    return NextResponse.json(
      { error: "Failed to fetch notification rule" },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications/rules/[id] - Update notification rule
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "update")
    if (!authorized) return response

    const { id } = await params
    const body = await request.json()
    const validatedData = updateRuleSchema.parse(body)

    // Verify rule belongs to organization
    const existingRule = await prisma.notificationRule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingRule) {
      return NextResponse.json(
        { error: "Notification rule not found" },
        { status: 404 }
      )
    }

    // Validate recipientUserId if provided
    if (validatedData.recipientUserId) {
      const user = await prisma.user.findFirst({
        where: {
          id: validatedData.recipientUserId,
          organizationId: session.user.organizationId,
        },
      })

      if (!user) {
        return NextResponse.json(
          { error: "Recipient user not found or does not belong to your organization" },
          { status: 400 }
        )
      }
    }

    // Validate recipientRoleId if provided
    if (validatedData.recipientRoleId) {
      const role = await prisma.role.findFirst({
        where: {
          id: validatedData.recipientRoleId,
          organizationId: session.user.organizationId,
        },
      })

      if (!role) {
        return NextResponse.json(
          { error: "Recipient role not found or does not belong to your organization" },
          { status: 400 }
        )
      }
    }

    // Validate recipientType constraints
    const finalRecipientType = validatedData.recipientType || existingRule.recipientType
    const finalRecipientUserId = validatedData.recipientUserId !== undefined
      ? validatedData.recipientUserId
      : existingRule.recipientUserId
    const finalRecipientRoleId = validatedData.recipientRoleId !== undefined
      ? validatedData.recipientRoleId
      : existingRule.recipientRoleId

    if (finalRecipientType === "USER" && !finalRecipientUserId) {
      return NextResponse.json(
        { error: "Recipient user must be specified when recipient type is USER" },
        { status: 400 }
      )
    }

    if (finalRecipientType === "ROLE" && !finalRecipientRoleId) {
      return NextResponse.json(
        { error: "Recipient role must be specified when recipient type is ROLE" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.trigger !== undefined) updateData.trigger = validatedData.trigger
    if (validatedData.daysOffset !== undefined) updateData.daysOffset = validatedData.daysOffset
    if (validatedData.channels !== undefined) updateData.channels = validatedData.channels
    if (validatedData.recipientType !== undefined) updateData.recipientType = validatedData.recipientType
    if (validatedData.recipientUserId !== undefined) updateData.recipientUserId = validatedData.recipientUserId
    if (validatedData.recipientRoleId !== undefined) updateData.recipientRoleId = validatedData.recipientRoleId
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive

    const rule = await prisma.notificationRule.update({
      where: { id },
      data: updateData,
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
    })

    return NextResponse.json(rule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error updating notification rule:", error)
    return NextResponse.json(
      { error: "Failed to update notification rule" },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications/rules/[id] - Delete notification rule
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "delete")
    if (!authorized) return response

    const { id } = await params

    // Verify rule belongs to organization
    const existingRule = await prisma.notificationRule.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingRule) {
      return NextResponse.json(
        { error: "Notification rule not found" },
        { status: 404 }
      )
    }

    await prisma.notificationRule.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting notification rule:", error)
    return NextResponse.json(
      { error: "Failed to delete notification rule" },
      { status: 500 }
    )
  }
}
