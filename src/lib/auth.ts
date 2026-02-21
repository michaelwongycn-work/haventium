import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "./prisma";
import { comparePassword } from "./password";
import { SUBSCRIPTION_STATUS } from "./constants";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
          select: {
            id: true,
            email: true,
            name: true,
            hashedPassword: true,
            organizationId: true,
            emailVerified: true,
            organization: {
              select: {
                subscription: {
                  include: {
                    tier: true,
                  },
                },
              },
            },
            userRoles: {
              select: {
                role: {
                  include: {
                    roleAccesses: {
                      include: {
                        access: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!user || !user.hashedPassword) {
          return null;
        }

        const isValidPassword = await comparePassword(
          credentials.password as string,
          user.hashedPassword,
        );

        if (!isValidPassword) {
          return null;
        }

        // Check subscription status
        const subscription = user.organization.subscription;
        if (
          subscription?.status === SUBSCRIPTION_STATUS.EXPIRED ||
          subscription?.status === SUBSCRIPTION_STATUS.CANCELLED
        ) {
          throw new Error("Subscription expired or cancelled");
        }
        // PENDING_PAYMENT users can log in — middleware will redirect them to /subscribe

        // Map roles directly without JSON hacks
        // We ensure we maintain the structure needed by access-utils
        const roles = user.userRoles.map((ur) => ({
          ...ur.role,
          // Ensure dates are strings if needed by NextAuth, though standard adapters handle Date
          createdAt: ur.role.createdAt.toISOString(),
          updatedAt: ur.role.updatedAt.toISOString(),
        }));

        // Prepare subscription object safely - convert Decimals to strings/numbers
        const safeSubscription = subscription
          ? {
              id: subscription.id,
              organizationId: subscription.organizationId,
              tierId: subscription.tierId,
              status: subscription.status,
              billingCycle: subscription.billingCycle,
              startDate: subscription.startDate.toISOString(),
              endDate: subscription.endDate?.toISOString() || null,
              trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
              cancelledAt: subscription.cancelledAt?.toISOString() || null,
              currentPeriodStart: subscription.currentPeriodStart.toISOString(),
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              externalId: subscription.externalId,
              createdAt: subscription.createdAt.toISOString(),
              updatedAt: subscription.updatedAt.toISOString(),
              tier: subscription.tier
                ? {
                    id: subscription.tier.id,
                    type: subscription.tier.type,
                    name: subscription.tier.name,
                    monthlyPrice: subscription.tier.monthlyPrice.toNumber(),
                    annualPrice: subscription.tier.annualPrice.toNumber(),
                    maxUsers: subscription.tier.maxUsers,
                    maxProperties: subscription.tier.maxProperties,
                    maxUnits: subscription.tier.maxUnits,
                    maxTenants: subscription.tier.maxTenants,
                  }
                : null,
            }
          : null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          subscription: safeSubscription,
          roles: roles,
          emailVerified: !!user.emailVerified,
        };
      },
    }),
  ],
});
