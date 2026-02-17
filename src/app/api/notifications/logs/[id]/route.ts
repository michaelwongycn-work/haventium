import { NextResponse } from "next/server"
import { checkAccess } from "@/lib/guards"
import { prisma } from "@/lib/prisma"

// GET /api/notifications/logs/[id] - Get single notification log
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await checkAccess("notifications", "read")
    if (!authorized) return response

    const { id } = await params

    const log = await prisma.notificationLog.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!log) {
      return NextResponse.json(
        { error: "Notification log not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(log)
  } catch (error) {
    console.error("Error fetching notification log:", error)
    return NextResponse.json(
      { error: "Failed to fetch notification log" },
      { status: 500 }
    )
  }
}
