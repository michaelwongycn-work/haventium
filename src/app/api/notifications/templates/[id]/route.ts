import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAccess } from "@/lib/api"
import { prisma } from "@/lib/prisma"
import type { NotificationChannel, NotificationTrigger } from "@prisma/client"
import { NOTIFICATION_CHANNEL, NOTIFICATION_TRIGGER } from "@/lib/constants"

const NOTIFICATION_CHANNELS = Object.values(NOTIFICATION_CHANNEL)
const NOTIFICATION_TRIGGERS = Object.values(NOTIFICATION_TRIGGER)

const updateTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required").optional(),
  trigger: z.enum(NOTIFICATION_TRIGGERS as [string, ...string[]]).optional(),
  channel: z.enum(NOTIFICATION_CHANNELS as [string, ...string[]]).optional(),
  subject: z.string().optional().nullable(),
  body: z.string().min(1, "Template body is required").optional(),
  isActive: z.boolean().optional(),
})

// GET /api/notifications/templates/[id] - Get single notification template
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "read")
    if (!authorized) return response

    const { id } = await params

    const template = await prisma.notificationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: "Notification template not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error("Error fetching notification template:", error)
    return NextResponse.json(
      { error: "Failed to fetch notification template" },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications/templates/[id] - Update notification template
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "update")
    if (!authorized) return response

    const { id } = await params
    const body = await request.json()
    const validatedData = updateTemplateSchema.parse(body)

    // Verify template belongs to organization
    const existingTemplate = await prisma.notificationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Notification template not found" },
        { status: 404 }
      )
    }

    // If name, trigger, or channel are being changed, check for duplicates
    if (
      (validatedData.name || validatedData.trigger || validatedData.channel) &&
      (validatedData.name !== existingTemplate.name ||
        validatedData.trigger !== existingTemplate.trigger ||
        validatedData.channel !== existingTemplate.channel)
    ) {
      const duplicateTemplate = await prisma.notificationTemplate.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: validatedData.name || existingTemplate.name,
          trigger: (validatedData.trigger || existingTemplate.trigger) as NotificationTrigger,
          channel: (validatedData.channel || existingTemplate.channel) as NotificationChannel,
          id: { not: id },
        },
      })

      if (duplicateTemplate) {
        return NextResponse.json(
          { error: "A template with this name, trigger, and channel already exists" },
          { status: 400 }
        )
      }
    }

    // Validate that email templates have a subject
    const finalChannel = validatedData.channel || existingTemplate.channel
    const finalSubject = validatedData.subject !== undefined ? validatedData.subject : existingTemplate.subject

    if (finalChannel === "EMAIL" && !finalSubject) {
      return NextResponse.json(
        { error: "Subject is required for email notifications" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.trigger !== undefined) updateData.trigger = validatedData.trigger as NotificationTrigger
    if (validatedData.channel !== undefined) updateData.channel = validatedData.channel as NotificationChannel
    if (validatedData.subject !== undefined) updateData.subject = validatedData.subject
    if (validatedData.body !== undefined) updateData.body = validatedData.body
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive

    const template = await prisma.notificationTemplate.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Error updating notification template:", error)
    return NextResponse.json(
      { error: "Failed to update notification template" },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications/templates/[id] - Delete notification template
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await requireAccess("notifications", "delete")
    if (!authorized) return response

    const { id } = await params

    // Verify template belongs to organization
    const existingTemplate = await prisma.notificationTemplate.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: "Notification template not found" },
        { status: 404 }
      )
    }

    await prisma.notificationTemplate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting notification template:", error)
    return NextResponse.json(
      { error: "Failed to delete notification template" },
      { status: 500 }
    )
  }
}
