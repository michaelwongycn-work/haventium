import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  requireAccess,
  checkSubscriptionLimit,
  ActivityLogger,
  apiSuccess,
  apiCreated,
  apiError,
  handleApiError,
  validateRequest,
  sanitizeSearchInput,
  parseEnumParam,
} from "@/lib/api"

const createTenantSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().optional().refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: "Invalid email address",
  }),
  phone: z.string().optional().refine((val) => !val || (/^[\d\s\-\+\(\)]+$/.test(val) && val.replace(/\D/g, "").length >= 8), {
    message: "Invalid phone number (at least 8 digits required)",
  }),
  preferEmail: z.boolean().default(false),
  preferWhatsapp: z.boolean().default(false),
}).refine((data) => data.email || data.phone, {
  message: "At least one contact method (email or phone) is required",
  path: ["email"],
})

const TENANT_STATUSES = ["LEAD", "BOOKED", "ACTIVE", "EXPIRED"] as const

// GET /api/tenants - List all tenants for the organization
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess("tenants", "read")
    if (!authorized) return response

    const { searchParams } = new URL(request.url)
    const status = parseEnumParam(searchParams.get("status"), TENANT_STATUSES)
    const search = sanitizeSearchInput(searchParams.get("search"))

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    }

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    const tenants = await prisma.tenant.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            leaseAgreements: true,
          },
        },
      },
    })

    return apiSuccess(tenants)
  } catch (error) {
    return handleApiError(error, "fetch tenants")
  }
}

// POST /api/tenants - Create new tenant
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess("tenants", "create")
    if (!authorized) return response

    const validatedData = await validateRequest(request, createTenantSchema)

    // Check subscription limits
    const limitCheck = await checkSubscriptionLimit(session, "tenants")
    if (!limitCheck.allowed) return limitCheck.error!

    // Check if email already exists in organization
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        email: validatedData.email,
        organizationId: session.user.organizationId,
      },
    })

    if (existingTenant) {
      return apiError("A tenant with this email already exists", 400)
    }

    const tenant = await prisma.tenant.create({
      data: {
        fullName: validatedData.fullName,
        email: validatedData.email || "",
        phone: validatedData.phone || "",
        status: "LEAD", // All new tenants start as LEAD
        preferEmail: validatedData.preferEmail,
        preferWhatsapp: validatedData.preferWhatsapp,
        organizationId: session.user.organizationId,
      },
    })

    // Log activity
    await ActivityLogger.tenantCreated(session, {
      id: tenant.id,
      fullName: tenant.fullName,
      email: tenant.email,
    })

    return apiCreated(tenant)
  } catch (error) {
    return handleApiError(error, "create tenant")
  }
}
