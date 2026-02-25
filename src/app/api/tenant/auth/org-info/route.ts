import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api";

export async function GET(): Promise<Response> {
  const headerStore = await headers();
  const organizationId = headerStore.get("x-org-id");
  if (!organizationId) return apiError("Not found", 404);

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  if (!org) return apiError("Not found", 404);

  return apiSuccess({ name: org.name });
}
