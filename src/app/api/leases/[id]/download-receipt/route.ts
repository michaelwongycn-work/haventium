import { prisma } from "@/lib/prisma";
import { requireAccess, apiSuccess, apiError, handleApiError } from "@/lib/api";
import { generateReceipt } from "@/lib/receipt-generator";
import { getCurrencySymbol } from "@/lib/format";
import { list } from "@vercel/blob";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;
    const organizationId = session.user.organizationId;

    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        leaseId: id,
        organizationId,
        status: "COMPLETED",
      },
      include: {
        lease: {
          include: {
            tenant: { select: { fullName: true } },
            unit: {
              include: { property: { select: { name: true } } },
            },
            organization: {
              select: { name: true, currency: true },
            },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    if (!transaction || !transaction.lease) {
      return apiError("No completed payment found for this lease", 404);
    }

    // Return existing blob if still available
    const storageKey = `receipts/rent-${transaction.id}.pdf`;
    const { blobs } = await list({ prefix: storageKey });
    const existing = blobs.find((b) => b.pathname === storageKey);
    if (existing) {
      return apiSuccess({ url: existing.url });
    }

    // Regenerate
    const lease = transaction.lease;
    const result = await generateReceipt({
      transactionId: transaction.id,
      organizationName: lease.organization.name,
      tenantName: lease.tenant.fullName,
      propertyName: lease.unit.property.name,
      unitName: lease.unit.name,
      leaseStartDate: lease.startDate.toLocaleDateString(),
      leaseEndDate: lease.endDate.toLocaleDateString(),
      amount: Number(transaction.amount).toFixed(2),
      currency: getCurrencySymbol(lease.organization.currency ?? "USD"),
      paidAt: (transaction.paidAt ?? transaction.updatedAt).toLocaleString(),
    });

    // Persist the new URL
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: { receiptUrl: result.url, receiptStorageKey: result.storageKey },
    });

    return apiSuccess({ url: result.url });
  } catch (error) {
    return handleApiError(error, "download receipt");
  }
}
