import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    const lease = await prisma.leaseAgreement.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    })

    if (!lease) {
      return NextResponse.json(
        { error: "Lease not found" },
        { status: 404 }
      )
    }

    const futureLease = await prisma.leaseAgreement.findFirst({
      where: {
        unitId: lease.unitId,
        id: { not: id },
        status: { in: ["DRAFT", "ACTIVE"] },
        startDate: { gt: lease.endDate },
      },
    })

    return NextResponse.json({ hasFutureLease: !!futureLease })
  } catch (error) {
    console.error("Error checking future leases:", error)
    return NextResponse.json(
      { error: "Failed to check future leases" },
      { status: 500 }
    )
  }
}
