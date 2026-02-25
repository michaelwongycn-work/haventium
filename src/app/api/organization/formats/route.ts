import { requireAccess, handleApiError, apiSuccess, validateRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateFormatsSchema = z.object({
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]),
  currency: z.string().min(3).max(3), // ISO currency code
});

// GET /api/settings/formats
export async function GET() {
  try {
    const { authorized, response, session } = await requireAccess("settings", "manage");
    if (!authorized) return response;

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        dateFormat: true,
        currency: true,
      },
    });

    if (!organization) {
      return apiSuccess({
        dateFormat: "dd/MM/yyyy",
        currency: "USD",
      });
    }

    return apiSuccess(organization);
  } catch (error) {
    return handleApiError(error, "fetch format settings");
  }
}

// PATCH /api/settings/formats
export async function PATCH(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess("settings", "manage");
    if (!authorized) return response;

    const validatedData = await validateRequest(request, updateFormatsSchema);

    const organization = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        dateFormat: validatedData.dateFormat,
        currency: validatedData.currency,
      },
      select: {
        dateFormat: true,
        currency: true,
      },
    });

    return apiSuccess(organization);
  } catch (error) {
    return handleApiError(error, "update format settings");
  }
}
