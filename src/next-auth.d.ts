import { DefaultSession } from "next-auth";
import { UserRole } from "@/lib/access-utils";

interface UserSubscription {
  id: string;
  organizationId: string;
  tierId: string;
  status: string;
  billingCycle: string;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  cancelledAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
  tier: {
    id: string;
    type: string;
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    maxUsers: number | null;
    maxProperties: number | null;
    maxUnits: number | null;
    maxTenants: number | null;
  } | null;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      subscription: UserSubscription | null;
      roles: UserRole[];
      emailVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    organizationId: string;
    subscription: UserSubscription | null;
    roles: UserRole[];
    emailVerified: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    organizationId: string;
    subscription: UserSubscription | null;
    roles: UserRole[];
    emailVerified: boolean;
  }
}
