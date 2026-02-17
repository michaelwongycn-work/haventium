import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  apiSuccess,
  handleApiError,
  sanitizeSearchInput,
  parsePaginationParams,
  createPaginatedResponse,
} from "@/lib/api";

const DOCUMENT_WITH_RELATIONS = {
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

// GET /api/documents - List all documents for the organization
export async function GET(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "documents",
      "read",
    );
    if (!authorized) return response;

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const search = sanitizeSearchInput(searchParams.get("search"));

    // Parse pagination params
    const { page, limit, skip } = parsePaginationParams({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    const where: Record<string, unknown> = {
      organizationId: session.user.organizationId,
    };

    // Filter by entity type and ID
    if (entityType && entityId) {
      switch (entityType) {
        case "property":
          where.propertyId = entityId;
          break;
        case "unit":
          where.unitId = entityId;
          break;
        case "tenant":
          where.tenantId = entityId;
          break;
        case "lease":
          where.leaseId = entityId;
          break;
      }
    }

    if (search) {
      where.filename = { contains: search, mode: "insensitive" };
    }

    // Fetch items and total count in parallel
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        ...DOCUMENT_WITH_RELATIONS,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip,
      }),
      prisma.document.count({ where }),
    ]);

    return apiSuccess(createPaginatedResponse(documents, page, limit, total));
  } catch (error) {
    return handleApiError(error, "fetch documents");
  }
}
