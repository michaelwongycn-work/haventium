import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";

export async function GET() {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      orderBy: { monthlyPrice: "asc" },
      include: {
        features: {
          include: { feature: true },
        },
      },
    });

    return NextResponse.json(tiers);
  } catch (error) {
    return handleApiError(error, "subscription-tiers");
  }
}
