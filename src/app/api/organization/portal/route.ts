import { z } from "zod";
import { requireAccess, requireFeature, handleApiError, apiSuccess, apiError } from "@/lib/api";
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

    const data = org ?? { subdomain: null };
    return apiSuccess({ ...data, locked: !!data.subdomain });
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

    const { allowed, response: featureResponse } = await requireFeature(session.user.organizationId, "TENANT_PORTAL");
    if (!allowed) return featureResponse;

    const organizationId = session.user.organizationId;
    const body = await request.json();
    const { subdomain } = updateSchema.parse(body);

    // Check if subdomain is already set — once set it's permanent
    const existing = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { subdomain: true },
    });

    if (existing?.subdomain) {
      return apiSuccess({ subdomain: existing.subdomain, locked: true });
    }

    // Check uniqueness across all orgs
    if (subdomain) {
      const taken = await prisma.organization.findFirst({
        where: { subdomain, NOT: { id: organizationId } },
        select: { id: true },
      });
      if (taken) {
        return apiError("This subdomain is already taken", 400);
      }
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(subdomain !== undefined && { subdomain }),
      },
      select: { subdomain: true },
    });

    return apiSuccess({ ...updated, locked: !!updated.subdomain });
  } catch (error) {
    return handleApiError(error, "update portal settings");
  }
}
