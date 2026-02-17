import { NextResponse } from "next/server";
import { requireAccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/notifications/logs/[id] - Get single notification log
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "notifications",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;

    const log = await prisma.notificationLog.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!log) {
      return NextResponse.json(
        { error: "Notification log not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(log);
  } catch (error) {
    return handleApiError(error, "fetch notification log");
  }
}
