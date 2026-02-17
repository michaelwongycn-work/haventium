import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashPassword, validatePassword } from "@/lib/password"
import { z } from "zod"

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
  organizationName: z.string().min(1, "Organization name is required"),
  tier: z.enum(["FREE", "NORMAL", "PRO"]),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = signupSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 }
      )
    }

    const { email, password, name, organizationName, tier } = validation.data

    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: "Password validation failed", details: passwordValidation.errors },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Get the subscription tier
    const subscriptionTier = await prisma.subscriptionTier.findUnique({
      where: { type: tier },
    })

    if (!subscriptionTier) {
      return NextResponse.json(
        { error: "Invalid subscription tier" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create organization, user, subscription, and default role in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
        },
      })

      // Create user
      const user = await tx.user.create({
        data: {
          email,
          name,
          hashedPassword,
          organizationId: organization.id,
        },
      })

      // Create subscription
      const now = new Date()
      const trialEnds = new Date(now)
      trialEnds.setDate(trialEnds.getDate() + 14) // 14 days trial

      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          tierId: subscriptionTier.id,
          status: tier === "FREE" ? "ACTIVE" : "TRIAL",
          billingCycle: "MONTHLY",
          startDate: now,
          endDate: tier === "FREE" ? new Date("2099-12-31") : trialEnds,
          trialEndsAt: tier === "FREE" ? null : trialEnds,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnds,
        },
      })

      // Create default "Owner" role
      const ownerRole = await tx.role.create({
        data: {
          name: "Owner",
          isSystem: true,
          organizationId: organization.id,
        },
      })

      // Assign user to Owner role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
        },
      })

      // Fetch all existing accesses and assign to Owner role
      const allAccesses = await tx.access.findMany()
      
      if (allAccesses.length > 0) {
        await tx.roleAccess.createMany({
          data: allAccesses.map((access: { id: string }) => ({
            roleId: ownerRole.id,
            accessId: access.id,
          })),
        })
      }


      return { user, organization, subscription }
    })

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "An error occurred during signup" },
      { status: 500 }
    )
  }
}
