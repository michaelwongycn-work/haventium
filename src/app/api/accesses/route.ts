import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/accesses - List all access permissions
export async function GET() {
  try {
    const { authorized, response } = await requireAccess("settings", "manage");
    if (!authorized) return response;

    const accesses = await prisma.access.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    return NextResponse.json(accesses);
  } catch (error) {
    console.error("Error fetching accesses:", error);
    return NextResponse.json(
      { error: "Failed to fetch accesses" },
      { status: 500 },
    );
  }
}
