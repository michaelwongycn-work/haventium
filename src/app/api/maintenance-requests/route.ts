import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  ActivityLogger,
  apiSuccess,
  apiCreated,
  apiNotFound,
  apiError,
  handleApiError,
  validateRequest,
  sanitizeSearchInput,
  parseEnumParam,
  parsePaginationParams,
  createPaginatedResponse,
} from "@/lib/api";

const createMaintenanceRequestSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  unitId: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
  leaseId: z.string().optional().nullable(),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("OPEN"),
  estimatedCost: z.number().min(0, "Estimated cost must be positive").optional().nullable(),
  actualCost: z.number().min(0, "Actual cost must be positive").optional().nullable(),
});

const MAINTENANCE_REQUEST_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const MAINTENANCE_REQUEST_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const MAINTENANCE_REQUEST_WITH_RELATIONS = {
  include: {
    property: true,
    unit: true,
    tenant: true,
    lease: {
      include: {
        tenant: true,
        unit: {
          include: {
            property: true,
          },
        },
      },
    },
  },
};

// GET /api/maintenance-requests - List all maintenance requests for the organization
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "maintenance",
      "read",
    );
    if (!authorized) return response;

    const { searchParams } = new URL(request.url);
    const status = parseEnumParam(searchParams.get("status"), MAINTENANCE_REQUEST_STATUSES);
    const priority = parseEnumParam(searchParams.get("priority"), MAINTENANCE_REQUEST_PRIORITIES);
    const propertyId = searchParams.get("propertyId");
    const unitId = searchParams.get("unitId");
    const search = sanitizeSearchInput(searchParams.get("search"));

    // Parse pagination params
    const { page, limit, skip } = parsePaginationParams({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (unitId) {
      where.unitId = unitId;
    }

    if (search) {
      where.OR = [
        {
          title: { contains: search, mode: "insensitive" },
        },
        {
          description: { contains: search, mode: "insensitive" },
        },
        {
          property: {
            name: { contains: search, mode: "insensitive" },
          },
        },
        {
          unit: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    // Fetch items and total count in parallel
    const [maintenanceRequests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        ...MAINTENANCE_REQUEST_WITH_RELATIONS,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip,
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return apiSuccess(createPaginatedResponse(maintenanceRequests, page, limit, total));
  } catch (error) {
    return handleApiError(error, "fetch maintenance requests");
  }
}

// POST /api/maintenance-requests - Create new maintenance request
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "maintenance",
      "create",
    );
    if (!authorized) return response;

    const validatedData = await validateRequest(request, createMaintenanceRequestSchema);

    // Verify property belongs to organization
    const property = await prisma.property.findFirst({
      where: {
        id: validatedData.propertyId,
        organizationId: session.user.organizationId,
      },
    });

    if (!property) {
      return apiNotFound("Property not found");
    }

    // Verify unit if provided
    if (validatedData.unitId) {
      const unit = await prisma.unit.findFirst({
        where: {
          id: validatedData.unitId,
          propertyId: validatedData.propertyId,
        },
      });

      if (!unit) {
        return apiError("Unit not found or doesn't belong to the specified property", 400);
      }
    }

    // Verify tenant if provided
    if (validatedData.tenantId) {
      const tenant = await prisma.tenant.findFirst({
        where: {
          id: validatedData.tenantId,
          organizationId: session.user.organizationId,
        },
      });

      if (!tenant) {
        return apiNotFound("Tenant not found");
      }
    }

    // Verify lease if provided
    if (validatedData.leaseId) {
      const lease = await prisma.leaseAgreement.findFirst({
        where: {
          id: validatedData.leaseId,
          organizationId: session.user.organizationId,
        },
      });

      if (!lease) {
        return apiNotFound("Lease not found");
      }
    }

    // Create maintenance request
    const maintenanceRequest = await prisma.maintenanceRequest.create({
      data: {
        ...validatedData,
        organizationId: session.user.organizationId,
      },
      ...MAINTENANCE_REQUEST_WITH_RELATIONS,
    });

    // Log activity
    await ActivityLogger.maintenanceRequestCreated(
      session,
      {
        id: maintenanceRequest.id,
        title: maintenanceRequest.title,
        propertyId: maintenanceRequest.propertyId,
      },
      {
        propertyName: property.name,
        unitName: maintenanceRequest.unit?.name,
      },
    );

    return apiCreated(maintenanceRequest);
  } catch (error) {
    return handleApiError(error, "create maintenance request");
  }
}
