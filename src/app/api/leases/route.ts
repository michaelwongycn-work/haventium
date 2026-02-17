import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  ActivityLogger,
  validateLeaseAvailability,
  LEASE_WITH_RELATIONS,
  apiSuccess,
  apiCreated,
  apiNotFound,
  apiError,
  handleApiError,
  validateRequest,
  sanitizeSearchInput,
  parseEnumParam,
} from "@/lib/api";

const createLeaseSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  unitId: z.string().min(1, "Unit is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  paymentCycle: z.enum(["DAILY", "MONTHLY", "ANNUAL"]),
  isAutoRenew: z.boolean().default(false),
  gracePeriodDays: z
    .number()
    .min(0, "Grace period must be positive")
    .optional()
    .nullable(),
  autoRenewalNoticeDays: z
    .number()
    .min(1, "Notice period must be at least 1 day")
    .optional()
    .nullable(),
  rentAmount: z.number().min(0, "Rent amount must be positive"),
  depositAmount: z
    .number()
    .min(0, "Deposit amount must be positive")
    .optional()
    .nullable(),
});

const LEASE_STATUSES = ["DRAFT", "ACTIVE", "ENDED"] as const;

// GET /api/leases - List all leases for the organization
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read",
    );
    if (!authorized) return response;

    const { searchParams } = new URL(request.url);
    const status = parseEnumParam(searchParams.get("status"), LEASE_STATUSES);
    const tenantId = searchParams.get("tenantId");
    const unitId = searchParams.get("unitId");
    const propertyId = searchParams.get("propertyId");
    const search = sanitizeSearchInput(searchParams.get("search"));

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (unitId) {
      where.unitId = unitId;
    }

    if (propertyId) {
      where.unit = {
        propertyId: propertyId,
      };
    }

    if (search) {
      where.OR = [
        {
          tenant: {
            fullName: { contains: search, mode: "insensitive" },
          },
        },
        {
          unit: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const leases = await prisma.leaseAgreement.findMany({
      where,
      ...LEASE_WITH_RELATIONS,
      orderBy: {
        startDate: "desc",
      },
    });

    return apiSuccess(leases);
  } catch (error) {
    return handleApiError(error, "fetch leases");
  }
}

// POST /api/leases - Create new lease agreement
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "create",
    );
    if (!authorized) return response;

    const validatedData = await validateRequest(request, createLeaseSchema);

    // Verify tenant belongs to organization
    const tenant = await prisma.tenant.findFirst({
      where: {
        id: validatedData.tenantId,
        organizationId: session.user.organizationId,
      },
    });

    if (!tenant) {
      return apiNotFound("Tenant not found");
    }

    // Verify unit belongs to organization and get property info
    const unit = await prisma.unit.findFirst({
      where: {
        id: validatedData.unitId,
        property: {
          organizationId: session.user.organizationId,
        },
      },
      include: {
        property: true,
      },
    });

    if (!unit) {
      return apiNotFound("Unit not found");
    }

    // Check if unit is unavailable
    if (unit.isUnavailable) {
      return apiError("This unit is marked as unavailable", 400);
    }

    // Validate dates and check for overlaps
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    const availabilityCheck = await validateLeaseAvailability({
      unitId: validatedData.unitId,
      startDate,
      endDate,
    });

    if (!availabilityCheck.valid) {
      return availabilityCheck.error!;
    }

    // Create lease agreement
    const lease = await prisma.leaseAgreement.create({
      data: {
        tenantId: validatedData.tenantId,
        unitId: validatedData.unitId,
        organizationId: session.user.organizationId,
        startDate,
        endDate,
        paymentCycle: validatedData.paymentCycle,
        rentAmount: validatedData.rentAmount,
        gracePeriodDays: validatedData.gracePeriodDays,
        isAutoRenew: validatedData.isAutoRenew,
        autoRenewalNoticeDays: validatedData.autoRenewalNoticeDays,
        depositAmount: validatedData.depositAmount,
        status: "DRAFT",
      },
      ...LEASE_WITH_RELATIONS,
    });

    // Update tenant status to BOOKED
    await prisma.tenant.update({
      where: { id: validatedData.tenantId },
      data: { status: "BOOKED" },
    });

    // Log activity
    await ActivityLogger.leaseCreated(
      session,
      {
        id: lease.id,
        tenantId: lease.tenantId,
        unitId: lease.unitId,
      },
      {
        tenantName: tenant.fullName,
        propertyName: unit.property.name,
        unitName: unit.name,
        propertyId: unit.propertyId,
      },
    );

    return apiCreated(lease);
  } catch (error) {
    return handleApiError(error, "create lease");
  }
}
