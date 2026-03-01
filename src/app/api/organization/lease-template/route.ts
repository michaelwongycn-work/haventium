import { z } from "zod";
import { requireAccess, handleApiError, apiSuccess } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  leaseAgreementTemplate: z.string().max(10000).nullable(),
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
      select: { leaseAgreementTemplate: true },
    });

    return apiSuccess({ leaseAgreementTemplate: org?.leaseAgreementTemplate ?? null });
  } catch (error) {
    return handleApiError(error, "fetch lease template");
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const { authorized, response, session } = await requireAccess(
      "settings",
      "manage",
    );
    if (!authorized) return response;

    const body = await request.json();
    const { leaseAgreementTemplate } = updateSchema.parse(body);

    const updated = await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: { leaseAgreementTemplate },
      select: { leaseAgreementTemplate: true },
    });

    return apiSuccess({ leaseAgreementTemplate: updated.leaseAgreementTemplate });
  } catch (error) {
    return handleApiError(error, "update lease template");
  }
}
