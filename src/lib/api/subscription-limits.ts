import { prisma } from "@/lib/prisma";
import { apiForbidden } from "./response";
import type { Session } from "next-auth";

/**
 * Subscription Limit Checker
 * Reusable utility for checking subscription limits
 */

export type LimitType = "users" | "tenants" | "properties" | "units";

interface LimitCheckResult {
  allowed: boolean;
  error?: ReturnType<typeof apiForbidden>;
  current?: number;
  max?: number;
}

const LIMIT_CONFIG: Record<
  LimitType,
  {
    maxField: "maxUsers" | "maxTenants" | "maxProperties" | "maxUnits";
    countQuery: (organizationId: string) => Promise<number>;
    resourceName: string;
  }
> = {
  users: {
    maxField: "maxUsers",
    countQuery: (orgId) =>
      prisma.user.count({ where: { organizationId: orgId } }),
    resourceName: "user",
  },
  tenants: {
    maxField: "maxTenants",
    countQuery: (orgId) =>
      prisma.tenant.count({ where: { organizationId: orgId } }),
    resourceName: "tenant",
  },
  properties: {
    maxField: "maxProperties",
    countQuery: (orgId) =>
      prisma.property.count({ where: { organizationId: orgId } }),
    resourceName: "property",
  },
  units: {
    maxField: "maxUnits",
    countQuery: (orgId) =>
      prisma.unit.count({
        where: { property: { organizationId: orgId } },
      }),
    resourceName: "unit",
  },
};

export async function checkSubscriptionLimit(
  session: Session,
  limitType: LimitType,
): Promise<LimitCheckResult> {
  const subscription = session.user.subscription;

  if (!subscription?.tier) {
    // No subscription tier, allow by default
    return { allowed: true };
  }

  const config = LIMIT_CONFIG[limitType];
  const maxAllowed = subscription.tier[config.maxField];

  // -1 means unlimited
  if (maxAllowed === -1) {
    return { allowed: true };
  }

  const currentCount = await config.countQuery(session.user.organizationId);

  if (currentCount >= maxAllowed) {
    return {
      allowed: false,
      current: currentCount,
      max: maxAllowed,
      error: apiForbidden(
        `${capitalize(config.resourceName)} limit reached. Your ${subscription.tier.name} plan allows ${maxAllowed} ${config.resourceName}${maxAllowed === 1 ? "" : "s"}.`,
      ),
    };
  }

  return {
    allowed: true,
    current: currentCount,
    max: maxAllowed,
  };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
