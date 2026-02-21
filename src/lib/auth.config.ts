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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.organizationId = user.organizationId;
        token.subscription = user.subscription;
        token.roles = user.roles;
        token.emailVerified = user.emailVerified;
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
