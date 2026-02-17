import { requireAccess, handleApiError, apiSuccess, validateRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateFormatsSchema = z.object({
  dateFormat: z.enum(["dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"]),
  currency: z.string().min(3).max(3), // ISO currency code
  currencySymbol: z.string().min(1).max(5),
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
        currencySymbol: true,
      },
    });

    if (!organization) {
      return apiSuccess({
        dateFormat: "dd/MM/yyyy",
        currency: "USD",
        currencySymbol: "$",
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
        currencySymbol: validatedData.currencySymbol,
      },
      select: {
        dateFormat: true,
        currency: true,
        currencySymbol: true,
      },
    });

    return apiSuccess(organization);
  } catch (error) {
    return handleApiError(error, "update format settings");
  }
}
