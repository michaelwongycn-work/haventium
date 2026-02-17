import { NextResponse } from "next/server";
import { requireAccess, handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;

    const lease = await prisma.leaseAgreement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!lease) {
      return NextResponse.json({ error: "Lease not found" }, { status: 404 });
    }

    const futureLease = await prisma.leaseAgreement.findFirst({
      where: {
        unitId: lease.unitId,
        id: { not: id },
        status: { in: ["DRAFT", "ACTIVE"] },
        startDate: { gt: lease.endDate },
      },
    });

    return NextResponse.json({ hasFutureLease: !!futureLease });
  } catch (error) {
    return handleApiError(error, "check future leases");
  }
}
