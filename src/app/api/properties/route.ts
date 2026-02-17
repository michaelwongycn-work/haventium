import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  checkSubscriptionLimit,
  ActivityLogger,
  apiSuccess,
  apiCreated,
  handleApiError,
  validateRequest,
} from "@/lib/api";

const createPropertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
});

// GET /api/properties - List all properties for the organization
export async function GET() {
  try {
    const { authorized, response, session } = await requireAccess(
      "properties",
      "read",
    );
    if (!authorized) return response;

    const properties = await prisma.property.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            units: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return apiSuccess(properties);
  } catch (error) {
    return handleApiError(error, "fetch properties");
  }
}

// POST /api/properties - Create new property
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "properties",
      "create",
    );
    if (!authorized) return response;

    const validatedData = await validateRequest(request, createPropertySchema);

    // Check subscription limits
    const limitCheck = await checkSubscriptionLimit(session, "properties");
    if (!limitCheck.allowed) return limitCheck.error!;

    const property = await prisma.property.create({
      data: {
        name: validatedData.name,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            units: true,
          },
        },
      },
    });

    // Log activity
    await ActivityLogger.propertyCreated(session, {
      id: property.id,
      name: property.name,
    });

    return apiCreated(property);
  } catch (error) {
    return handleApiError(error, "create property");
  }
}
