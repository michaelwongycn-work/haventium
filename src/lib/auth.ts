import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import { prisma } from "./prisma"
import { comparePassword } from "./password"

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
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
          include: {
            organization: {
              include: {
                subscription: {
                  include: {
                    tier: true,
                  },
                },
              },
            },
            userRoles: {
              include: {
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
        })

        if (!user || !user.hashedPassword) {
          return null
        }

        const isValidPassword = await comparePassword(
          credentials.password as string,
          user.hashedPassword
        )

        if (!isValidPassword) {
          return null
        }

        // Check subscription status
        if (
          user.organization.subscription?.status === "EXPIRED" ||
          user.organization.subscription?.status === "CANCELLED"
        ) {
          throw new Error("Subscription expired or cancelled")
        }

      const subscription = user.organization.subscription ? JSON.parse(JSON.stringify(user.organization.subscription)) : null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: user.organizationId,
          subscription: subscription,
          roles: JSON.parse(JSON.stringify(user.userRoles.map((ur: any) => ur.role))),
        }
      },
    }),
  ],
})

