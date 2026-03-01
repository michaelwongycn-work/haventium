import { prisma } from "@/lib/prisma";
import { requireAccess, apiSuccess, apiError, handleApiError } from "@/lib/api";
import { generateLeaseAgreement } from "@/lib/lease-agreement-generator";
import { formatDate, formatCurrency } from "@/lib/format";
import { subDays, subMonths, subYears } from "date-fns";
import { list } from "@vercel/blob";

const CYCLE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
};

function computeLastPaymentDate(endDate: Date, paymentCycle: string): Date {
  switch (paymentCycle) {
    case "DAILY":   return subDays(endDate, 1);
    case "ANNUAL":  return subYears(endDate, 1);
    default:        return subMonths(endDate, 1); // MONTHLY
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "update",
    );
    if (!authorized) return response;

    const { id } = await params;
    const organizationId = session.user.organizationId;

    const lease = await prisma.leaseAgreement.findFirst({
      where: { id, organizationId },
      include: {
        tenant: {
          select: { fullName: true, email: true, phone: true },
        },
        unit: {
          include: {
            property: { select: { name: true } },
          },
        },
        organization: {
          select: {
            name: true,
            leaseAgreementTemplate: true,
            currency: true,
            currencySymbol: true,
          },
        },
      },
    });

    if (!lease) {
      return apiError("Lease not found", 404);
    }

    // Return existing PDF if already generated
    const storageKey = `lease-agreements/lease-${lease.id}.pdf`;
    const { blobs } = await list({ prefix: storageKey });
    const existing = blobs.find((b) => b.pathname === storageKey);
    if (existing) {
      return apiSuccess({ url: existing.url });
    }

    const lastPaymentDate = lease.isAutoRenew
      ? formatDate(computeLastPaymentDate(lease.endDate, lease.paymentCycle))
      : null;
    const lastCancellationDate = lease.isAutoRenew && lease.autoRenewalNoticeDays != null
      ? formatDate(subDays(lease.endDate, lease.autoRenewalNoticeDays))
      : null;

    const result = await generateLeaseAgreement({
      leaseId: lease.id,
      organizationName: lease.organization.name,
      tenantName: lease.tenant.fullName,
      tenantEmail: lease.tenant.email ?? "",
      tenantPhone: lease.tenant.phone ?? "",
      propertyName: lease.unit.property.name,
      unitName: lease.unit.name,
      startDate: formatDate(lease.startDate),
      endDate: formatDate(lease.endDate),
      paymentCycle: CYCLE_LABELS[lease.paymentCycle] ?? lease.paymentCycle,
      rentAmount: formatCurrency(Number(lease.rentAmount), { currency: lease.organization.currency }),
      depositAmount: lease.depositAmount
        ? formatCurrency(Number(lease.depositAmount), { currency: lease.organization.currency })
        : null,
      isAutoRenew: lease.isAutoRenew,
      gracePeriodDays: lease.gracePeriodDays,
      autoRenewalNoticeDays: lease.autoRenewalNoticeDays,
      lastPaymentDate,
      lastCancellationDate,
      templateClauses: lease.organization.leaseAgreementTemplate ?? null,
    });

    return apiSuccess({ url: result.url });
  } catch (error) {
    return handleApiError(error, "generate lease agreement");
  }
}
