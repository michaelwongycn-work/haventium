import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/access-utils";

// Type guard to check if value is UserSubscription
function isUserSubscription(
  value: unknown,
): value is NonNullable<import("next-auth").User["subscription"]> {
  return value !== null && typeof value === "object";
}

// Type guard to check if value is UserRole array
function isUserRoleArray(value: unknown): value is UserRole[] {
  return Array.isArray(value);
}

export const authConfig = {
  providers: [],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.organizationId = user.organizationId;
        token.subscription = user.subscription;
        token.roles = user.roles;
        token.emailVerified = user.emailVerified;
      }
      // Handle session update from unstable_update (e.g. after subscription payment)
      if (trigger === "update" && session?.user?.subscription) {
        token.subscription = session.user.subscription;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string;
        session.user.subscription = isUserSubscription(token.subscription)
          ? token.subscription
          : null;
        session.user.roles = isUserRoleArray(token.roles) ? token.roles : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).emailVerified = token.emailVerified ?? false;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
