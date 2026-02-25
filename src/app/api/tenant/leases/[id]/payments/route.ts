import { requireTenantAuth, handleApiError, apiSuccess, apiNotFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await requireTenantAuth();
    if (!auth.authorized) return auth.response;
    const { tenantId, organizationId } = auth.tenant;
    const { id } = await params;

    // Verify lease ownership
    const lease = await prisma.leaseAgreement.findFirst({
      where: { id, tenantId, organizationId },
      select: { id: true },
    });
    if (!lease) return apiNotFound("Lease");

    const payments = await prisma.paymentTransaction.findMany({
      where: { leaseId: id, organizationId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        gateway: true,
        externalId: true,
        xenditInvoiceId: true,
        paymentLinkUrl: true,
        amount: true,
        status: true,
        receiptUrl: true,
        paidAt: true,
        createdAt: true,
        // externalResponse intentionally excluded
      },
    });

    return apiSuccess(payments);
  } catch (error) {
    return handleApiError(error, "fetch lease payments");
  }
}
