import { NextResponse } from "next/server";
import { requireAccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/accesses - List all access permissions
export async function GET() {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const accesses = await prisma.access.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    return NextResponse.json(accesses);
  } catch (error) {
    return handleApiError(error, "fetch accesses");
  }
}
