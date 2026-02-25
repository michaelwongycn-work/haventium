import { requireTenantAuth, handleApiError, apiNotFound, apiForbidden } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;
    const { id } = await params;

    const doc = await prisma.document.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        filename: true,
        fileUrl: true,
        tenantId: true,
        leaseId: true,
      },
    });

    if (!doc) return apiNotFound("Document");

    // Verify ownership: document must belong to tenant directly OR via a lease
    let allowed = doc.tenantId === tenantId;
    if (!allowed && doc.leaseId) {
      const lease = await prisma.leaseAgreement.findFirst({
        where: { id: doc.leaseId, tenantId, organizationId },
        select: { id: true },
      });
      allowed = !!lease;
    }

    if (!allowed) return apiForbidden();

    // Redirect to Vercel Blob URL — never expose storageKey
    return NextResponse.redirect(doc.fileUrl);
  } catch (error) {
    return handleApiError(error, "fetch document");
  }
}
