import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api";

// GET /api/subscription-tiers — no auth required
export async function GET() {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      orderBy: { monthlyPrice: "asc" },
      include: {
        features: {
          include: { feature: true },
          orderBy: { feature: { name: "asc" } },
        },
      },
    });

    const serialized = tiers.map((tier) => ({
      id: tier.id,
      type: tier.type,
      name: tier.name,
      monthlyPrice: Number(tier.monthlyPrice),
      annualPrice: Number(tier.annualPrice),
      maxUsers: tier.maxUsers,
      maxProperties: tier.maxProperties,
      maxUnits: tier.maxUnits,
      maxTenants: tier.maxTenants,
      features: tier.features.map((tf) => tf.feature.name),
    }));

    return NextResponse.json({ items: serialized });
  } catch (error) {
    return handleApiError(error, "fetch subscription tiers");
  }
}
