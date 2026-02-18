import { prisma } from "@/lib/prisma";
import SignupForm from "./signup-form";

export default async function SignupPage() {
  const tiers = await prisma.subscriptionTier.findMany({
    orderBy: { monthlyPrice: "asc" },
    include: {
      features: {
        include: { feature: true },
        orderBy: { feature: { name: "asc" } },
      },
    },
  });

  const serializedTiers = tiers.map((tier) => ({
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

  return <SignupForm tiers={serializedTiers} />;
}
