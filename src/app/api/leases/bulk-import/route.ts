import { z } from "zod";
import {
  requireAccess,
  handleApiError,
  ActivityLogger,
  apiSuccess,
  apiError,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  validateBulkData,
} from "@/lib/bulk-validation";
import { parseBooleanField, parseDateFromExcel } from "@/lib/excel-utils";

// Zod schema for bulk lease import
const bulkLeaseSchema = z.object({
  "Tenant Email": z.string().email("Invalid email format"),
  "Property Name": z.string().min(1, "Property name is required"),
  "Unit Name": z.string().min(1, "Unit name is required"),
  "Start Date": z.string().min(1, "Start date is required"),
  "End Date": z.string().min(1, "End date is required"),
  "Payment Cycle": z.enum(["DAILY", "MONTHLY", "ANNUAL"]),
  "Rent Amount": z.number().min(0.01, "Rent amount must be greater than 0"),
  "Deposit Amount": z.number().min(0).optional().nullable(),
  "Grace Period Days": z.number().int().min(0).optional().nullable(),
  "Auto Renew": z
    .union([z.boolean(), z.string()])
    .transform((val) => parseBooleanField(val))
    .optional()
    .default(false),
  "Auto Renewal Notice Days": z.number().int().min(1).optional().nullable(),
});

type BulkLeaseInput = z.infer<typeof bulkLeaseSchema>;

// Request schema
const requestSchema = z.object({
  dryRun: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.unknown())),
});

type ValidationError = {
  rowIndex: number;
  data: BulkLeaseInput;
  errors: string[];
};

// Batch check lease availability for all units
async function batchCheckLeaseAvailability(
  organizationId: string,
  leases: Array<{
    unitId: string;
    startDate: Date;
    endDate: Date;
  }>
): Promise<Map<string, boolean>> {
  const unitIds = [...new Set(leases.map((l) => l.unitId))];

  // Fetch all existing DRAFT/ACTIVE leases for these units in ONE query
  const existingLeases = await prisma.leaseAgreement.findMany({
    where: {
      unitId: { in: unitIds },
      status: { in: ["DRAFT", "ACTIVE"] },
      unit: {
        property: {
          organizationId,
        },
      },
    },
    select: {
      id: true,
      unitId: true,
      startDate: true,
      endDate: true,
    },
  });

  // Group by unitId for fast lookup
  const leasesByUnit = existingLeases.reduce(
    (acc, lease) => {
      if (!acc[lease.unitId]) acc[lease.unitId] = [];
      acc[lease.unitId].push(lease);
      return acc;
    },
    {} as Record<string, typeof existingLeases>
  );

  // Check each import lease against existing leases
  const availabilityMap = new Map<string, boolean>();

  leases.forEach((importLease) => {
    const existing = leasesByUnit[importLease.unitId] || [];
    const hasOverlap = existing.some(
      (e) =>
        importLease.startDate <= e.endDate &&
        importLease.endDate >= e.startDate
    );

    // Use a composite key: unitId + startDate + endDate
    const key = `${importLease.unitId}::${importLease.startDate.toISOString()}::${importLease.endDate.toISOString()}`;
    availabilityMap.set(key, !hasOverlap);
  });

  return availabilityMap;
}

// POST /api/leases/bulk-import
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "leases",
      "create"
    );
    if (!authorized) return response;

    const body = await request.json();
    const { dryRun, rows } = requestSchema.parse(body);

    if (rows.length === 0) {
      return apiError("No rows provided", 400);
    }

    if (rows.length > 1000) {
      return apiError("Maximum 1000 rows allowed per import", 400);
    }

    // Validate all rows
    let validationResult = validateBulkData(rows, bulkLeaseSchema);

    // Additional validation: Parse dates and check business rules
    const newValid = [];
    const newInvalid: ValidationError[] = [...validationResult.invalid];

    for (const validRow of validationResult.valid) {
      const data = validRow.data;
      const errors: string[] = [];

      // Parse dates
      const startDate = parseDateFromExcel(data["Start Date"]);
      const endDate = parseDateFromExcel(data["End Date"]);

      if (!startDate) {
        errors.push("Start Date: Invalid date format");
      }
      if (!endDate) {
        errors.push("End Date: Invalid date format");
      }

      if (startDate && endDate && startDate >= endDate) {
        errors.push("Dates: Start date must be before end date");
      }

      // Check auto-renewal rules
      if (data["Auto Renew"] && !data["Auto Renewal Notice Days"]) {
        errors.push(
          "Auto Renewal Notice Days: Required when Auto Renew is TRUE"
        );
      }

      if (errors.length > 0) {
        newInvalid.push({
          ...validRow,
          errors,
        });
      } else {
        newValid.push(validRow);
      }
    }

    validationResult = {
      valid: newValid,
      invalid: newInvalid,
      summary: {
        total: rows.length,
        valid: newValid.length,
        invalid: newInvalid.length,
      },
    };

    // Lookup tenants and units (only for valid rows)
    const enrichedData: Array<{
      validationRow: (typeof validationResult.valid)[0];
      tenantId: string | null;
      unitId: string | null;
      propertyId: string | null;
      startDate: Date | null;
      endDate: Date | null;
      errors: string[];
    }> = [];

    if (validationResult.valid.length > 0) {
      // Lookup all tenants by email
      const emails = validationResult.valid.map((v) =>
        v.data["Tenant Email"].toLowerCase().trim()
      );

      const tenants = await prisma.tenant.findMany({
        where: {
          organizationId: session.user.organizationId,
          email: {
            in: emails,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          email: true,
        },
      });

      const tenantsByEmail = new Map(
        tenants.map((t) => [t.email.toLowerCase(), t.id])
      );

      // Lookup all properties and units
      const propertyNames = [
        ...new Set(
          validationResult.valid.map((v) =>
            v.data["Property Name"].toLowerCase().trim()
          )
        ),
      ];

      const properties = await prisma.property.findMany({
        where: {
          organizationId: session.user.organizationId,
          name: {
            in: Array.from(propertyNames),
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          units: {
            select: {
              id: true,
              name: true,
              isUnavailable: true,
            },
          },
        },
      });

      const unitLookup = new Map<string, { id: string; propertyId: string; isUnavailable: boolean }>();
      properties.forEach((property) => {
        property.units.forEach((unit) => {
          const key = `${property.name.toLowerCase()}::${unit.name.toLowerCase()}`;
          unitLookup.set(key, {
            id: unit.id,
            propertyId: property.id,
            isUnavailable: unit.isUnavailable
          });
        });
      });

      // Enrich each valid row with tenant and unit IDs
      for (const validRow of validationResult.valid) {
        const data = validRow.data;
        const errors: string[] = [];

        const tenantEmail = data["Tenant Email"].toLowerCase().trim();
        const tenantId = tenantsByEmail.get(tenantEmail);

        if (!tenantId) {
          errors.push("Tenant Email: Tenant not found");
        }

        const propertyName = data["Property Name"].toLowerCase().trim();
        const unitName = data["Unit Name"].toLowerCase().trim();
        const unitKey = `${propertyName}::${unitName}`;
        const unitData = unitLookup.get(unitKey);

        if (!unitData) {
          errors.push("Unit: Unit not found in specified property");
        } else if (unitData.isUnavailable) {
          errors.push("Unit: Unit is marked as unavailable");
        }

        const startDate = parseDateFromExcel(data["Start Date"]);
        const endDate = parseDateFromExcel(data["End Date"]);

        enrichedData.push({
          validationRow: validRow,
          tenantId: tenantId || null,
          unitId: unitData?.id || null,
          propertyId: unitData?.propertyId || null,
          startDate,
          endDate,
          errors,
        });
      }

      // Batch check lease availability
      const leasesToCheck = enrichedData
        .filter((item) => item.unitId && item.startDate && item.endDate && item.errors.length === 0)
        .map((item) => ({
          unitId: item.unitId!,
          startDate: item.startDate!,
          endDate: item.endDate!,
        }));

      const availabilityMap = await batchCheckLeaseAvailability(
        session.user.organizationId,
        leasesToCheck
      );

      // Add overlap errors
      enrichedData.forEach((item) => {
        if (item.unitId && item.startDate && item.endDate) {
          const key = `${item.unitId}::${item.startDate.toISOString()}::${item.endDate.toISOString()}`;
          const isAvailable = availabilityMap.get(key);
          if (isAvailable === false) {
            item.errors.push(
              "Unit: Not available for selected dates (overlapping lease exists)"
            );
          }
        }
      });

      // Separate valid and invalid based on enrichment
      const finalValid = enrichedData.filter((item) => item.errors.length === 0);
      const finalInvalid = [
        ...validationResult.invalid,
        ...enrichedData
          .filter((item) => item.errors.length > 0)
          .map((item) => ({
            rowIndex: item.validationRow.rowIndex,
            data: item.validationRow.data,
            errors: item.errors,
          })),
      ];

      validationResult = {
        valid: finalValid.map((item) => item.validationRow),
        invalid: finalInvalid,
        summary: {
          total: rows.length,
          valid: finalValid.length,
          invalid: finalInvalid.length,
        },
      };

      // Note: No subscription limit check for leases - they are unlimited across all tiers
    }

    // If dry run, return validation results only
    if (dryRun) {
      return apiSuccess({
        summary: {
          ...validationResult.summary,
          created: 0,
        },
        validRows: validationResult.valid,
        invalidRows: validationResult.invalid,
        createdIds: [],
      });
    }

    // Actually create the leases
    const createdIds: string[] = [];

    for (const enrichedItem of enrichedData.filter(
      (item) => item.errors.length === 0
    )) {
      const data = enrichedItem.validationRow.data;

      const lease = await prisma.leaseAgreement.create({
        data: {
          organizationId: session.user.organizationId,
          tenantId: enrichedItem.tenantId!,
          unitId: enrichedItem.unitId!,
          startDate: enrichedItem.startDate!,
          endDate: enrichedItem.endDate!,
          paymentCycle: data["Payment Cycle"],
          rentAmount: data["Rent Amount"],
          depositAmount: data["Deposit Amount"] ?? 0,
          gracePeriodDays: data["Grace Period Days"] ?? 0,
          isAutoRenew: data["Auto Renew"],
          autoRenewalNoticeDays: data["Auto Renewal Notice Days"] ?? null,
          status: "DRAFT", // All imported leases start as DRAFT
          depositStatus: "HELD",
        },
      });

      createdIds.push(lease.id);

      // Update tenant status to BOOKED
      await prisma.tenant.update({
        where: { id: enrichedItem.tenantId! },
        data: { status: "BOOKED" },
      });

      // Fetch tenant details for activity logging
      const tenant = await prisma.tenant.findUnique({
        where: { id: enrichedItem.tenantId! },
        select: { fullName: true },
      });

      // Log activity
      await ActivityLogger.leaseCreated(
        session,
        {
          id: lease.id,
          tenantId: lease.tenantId,
          unitId: lease.unitId,
        },
        {
          tenantName: tenant?.fullName || data["Tenant Email"],
          propertyName: data["Property Name"],
          unitName: data["Unit Name"],
          propertyId: enrichedItem.propertyId!,
        }
      );
    }

    return apiSuccess({
      summary: {
        ...validationResult.summary,
        created: createdIds.length,
      },
      validRows: validationResult.valid,
      invalidRows: validationResult.invalid,
      createdIds,
    });
  } catch (error) {
    return handleApiError(error, "bulk import leases");
  }
}
