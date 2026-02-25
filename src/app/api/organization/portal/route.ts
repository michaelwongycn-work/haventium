import { z } from "zod";
import { requireAccess, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  subdomain: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
    .min(2)
    .max(63)
    .nullable()
    .optional(),
});

export async function GET(): Promise<Response> {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const org = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { subdomain: true },
    });

    return apiSuccess(org ?? { subdomain: null });
  } catch (error) {
    return handleApiError(error, "fetch portal settings");
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const organizationId = session.user.organizationId;
    const body = await request.json();
    const { subdomain } = updateSchema.parse(body);

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(subdomain !== undefined && { subdomain }),
      },
      select: { subdomain: true },
    });

    return apiSuccess(updated);
  } catch (error) {
    return handleApiError(error, "update portal settings");
  }
}
