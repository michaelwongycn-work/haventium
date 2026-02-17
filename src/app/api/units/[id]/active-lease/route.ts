import { NextResponse } from "next/server";
import { requireAccess, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/units/[id]/active-lease - Get active lease for a unit
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read"
    );
    if (!authorized) return response;

    const { id } = await params;

    // Verify unit belongs to organization
    const unit = await prisma.unit.findFirst({
      where: {
        id,
        property: {
          organizationId: session.user.organizationId,
        },
      },
    });

    if (!unit) {
      return NextResponse.json(
        { error: "Unit not found" },
        { status: 404 }
      );
    }

    // Find active lease for this unit
    const activeLease = await prisma.leaseAgreement.findFirst({
      where: {
        unitId: id,
        status: "ACTIVE",
        organizationId: session.user.organizationId,
      },
      include: {
        tenant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    return apiSuccess({
      lease: activeLease || null,
    });
  } catch (error) {
    return handleApiError(error, "fetch active lease for unit");
  }
}
