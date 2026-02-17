import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { apiError, apiServerError } from "./response"

/**
 * Centralized Error Handler
 * Handles common error types across all API routes
 */

export function handleApiError(error: unknown, context: string = "operation"): NextResponse {
  // Zod validation errors
  if (error instanceof z.ZodError) {
    return apiError(error.issues[0].message, 400)
  }

  // Prisma unique constraint violations
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const field = (error.meta?.target as string[])?.[0] || "field"
      return apiError(`A record with this ${field} already exists`, 400)
    }
    
    if (error.code === "P2025") {
      return apiError("Record not found", 404)
    }

    if (error.code === "P2003") {
      return apiError("Related record not found", 400)
    }
  }

  // Custom error messages (thrown as Error with specific messages)
  if (error instanceof Error) {
    // Check for custom error codes
    const customErrors: Record<string, { message: string; status: number }> = {
      ROLE_NOT_FOUND: { message: "Role not found", status: 400 },
      USER_NOT_FOUND: { message: "User not found", status: 404 },
      TENANT_NOT_FOUND: { message: "Tenant not found", status: 404 },
      PROPERTY_NOT_FOUND: { message: "Property not found", status: 404 },
      UNIT_NOT_FOUND: { message: "Unit not found", status: 404 },
      LEASE_NOT_FOUND: { message: "Lease not found", status: 404 },
      UNAUTHORIZED: { message: "Unauthorized", status: 401 },
      FORBIDDEN: { message: "Forbidden", status: 403 },
    }

    const customError = customErrors[error.message]
    if (customError) {
      return apiError(customError.message, customError.status)
    }
  }

  // Log unexpected errors
  console.error(`Error in ${context}:`, error)

  // Generic server error
  return apiServerError(`Failed to ${context}`)
}

/**
 * Async error wrapper for API route handlers
 * Automatically catches and handles errors
 */
export function withErrorHandler<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse>,
  context: string = "operation"
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error, context)
    }
  }
}
