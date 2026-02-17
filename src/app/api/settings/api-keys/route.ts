import { z } from "zod"
import { prisma } from "@/lib/prisma"
import type { ApiKeyService } from "@prisma/client"
import {
  requireAccess,
  apiSuccess,
  apiCreated,
  apiError,
  handleApiError,
  validateRequest,
  logActivity,
} from "@/lib/api"
import { encrypt, getLastFourChars, maskApiKey } from "@/lib/encryption"

const API_KEY_SERVICES = ["RESEND_EMAIL", "WHATSAPP_META", "TELEGRAM_BOT"] as const

const createApiKeySchema = z.object({
  name: z.string().min(1, "API key name is required"),
  service: z.enum(API_KEY_SERVICES),
  value: z.string().min(1, "API key value is required"),
})

// GET /api/settings/api-keys - List all API keys for the organization
export async function GET() {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage"
    )
    if (!authorized) return response

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        service: true,
        lastFourChars: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastUsedAt: true,
      },
    })

    // Add masked display
    const maskedKeys = apiKeys.map((key) => ({
      ...key,
      maskedValue: key.service.includes("RESEND")
        ? `re_••••••••${key.lastFourChars}`
        : `••••••••${key.lastFourChars}`,
    }))

    return apiSuccess(maskedKeys)
  } catch (error) {
    return handleApiError(error, "fetch API keys")
  }
}

// POST /api/settings/api-keys - Create new API key
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage"
    )
    if (!authorized) return response

    const validatedData = await validateRequest(request, createApiKeySchema)

    // Check if API key for this service already exists
    const existingKey = await prisma.apiKey.findUnique({
      where: {
        organizationId_service: {
          organizationId: session.user.organizationId,
          service: validatedData.service as ApiKeyService,
        },
      },
    })

    if (existingKey) {
      return apiError(
        `An API key for ${validatedData.service} already exists. Delete the existing key first.`,
        400
      )
    }

    // Encrypt the API key
    const { encrypted, iv, tag } = encrypt(validatedData.value)
    const lastFourChars = getLastFourChars(validatedData.value)

    const apiKey = await prisma.apiKey.create({
      data: {
        name: validatedData.name,
        service: validatedData.service as ApiKeyService,
        encryptedValue: encrypted,
        encryptionIv: iv,
        encryptionTag: tag,
        lastFourChars,
        organizationId: session.user.organizationId,
      },
    })

    // Log activity
    await logActivity(session, {
      type: "API_KEY_CREATED",
      description: `Created API key: ${validatedData.name} (${validatedData.service})`,
    })

    // Return full key only once (client should save it)
    return apiCreated({
      ...apiKey,
      fullKey: validatedData.value, // Only shown once!
      maskedValue: maskApiKey(validatedData.value),
    })
  } catch (error) {
    return handleApiError(error, "create API key")
  }
}
