import { prisma } from "@/lib/prisma"
import { comparePassword } from "@/lib/password"
import { apiError } from "./response"
import type { Session } from "next-auth"

/**
 * Password Verification Middleware
 * Reusable password verification for sensitive operations
 */

export interface PasswordVerificationResult {
  verified: boolean
  error?: ReturnType<typeof apiError>
}

export async function verifyCurrentUserPassword(
  session: Session,
  password: string
): Promise<PasswordVerificationResult> {
  if (!password) {
    return {
      verified: false,
      error: apiError("Your password is required to confirm this action", 400),
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hashedPassword: true },
  })

  if (!user?.hashedPassword) {
    return {
      verified: false,
      error: apiError("Unable to verify your identity", 400),
    }
  }

  const isValid = await comparePassword(password, user.hashedPassword)

  if (!isValid) {
    return {
      verified: false,
      error: apiError("Incorrect password", 400),
    }
  }

  return { verified: true }
}

/**
 * Extract password from request body
 */
export async function extractPasswordFromRequest(
  request: Request
): Promise<string | null> {
  try {
    const body = await request.json()
    return body.currentPassword || null
  } catch {
    return null
  }
}
