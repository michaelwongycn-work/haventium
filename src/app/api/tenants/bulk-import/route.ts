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
  checkDuplicates,
  addDuplicateErrors,
} from "@/lib/bulk-validation";
import { parseBooleanField, trimString } from "@/lib/excel-utils";

// Zod schema for bulk tenant import
const bulkTenantSchema = z.object({
  "Full Name": z.string().min(1, "Full name is required"),
  Email: z.string().email("Invalid email format"),
  Phone: z.string().min(1, "Phone is required"),
  Status: z
    .enum(["LEAD", "BOOKED", "ACTIVE", "EXPIRED"])
    .optional()
    .default("LEAD"),
  "Prefer Email": z
    .union([z.boolean(), z.string()])
    .transform((val) => parseBooleanField(val))
    .optional()
    .default(true),
  "Prefer WhatsApp": z
    .union([z.boolean(), z.string()])
    .transform((val) => parseBooleanField(val))
    .optional()
    .default(false),
  "Prefer Telegram": z
    .union([z.boolean(), z.string()])
    .transform((val) => parseBooleanField(val))
    .optional()
    .default(false),
});

// Request schema
const requestSchema = z.object({
  dryRun: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.unknown())),
});

// POST /api/tenants/bulk-import
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "tenants",
      "create",
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
    let validationResult = validateBulkData(rows, bulkTenantSchema);

    // Check for duplicate emails within the import file
    const duplicateEmails = checkDuplicates(
      validationResult.valid.map((v) => v.data),
      (row) => row.Email,
    );

    if (duplicateEmails.size > 0) {
      validationResult = addDuplicateErrors(
        validationResult,
        duplicateEmails,
        "Email",
      );
    }

    // Check for existing emails in database (only for valid rows)
    if (validationResult.valid.length > 0) {
      const emails = validationResult.valid.map((v) =>
        v.data.Email.toLowerCase().trim(),
      );

      const existingTenants = await prisma.tenant.findMany({
        where: {
          organizationId: session.user.organizationId,
          email: {
            in: emails,
          },
        },
        select: {
          email: true,
        },
      });

      const existingEmailsSet = new Set(
        existingTenants.map((t) => t.email.toLowerCase()),
      );

      // Move rows with existing emails to invalid
      const newValid = validationResult.valid.filter(
        (v) => !existingEmailsSet.has(v.data.Email.toLowerCase().trim()),
      );

      const newInvalid = [
        ...validationResult.invalid,
        ...validationResult.valid
          .filter((v) =>
            existingEmailsSet.has(v.data.Email.toLowerCase().trim()),
          )
          .map((v) => ({
            ...v,
            errors: ["Email: Email already exists in database"],
          })),
      ];

      validationResult = {
        valid: newValid,
        invalid: newInvalid,
        summary: {
          total: rows.length,
          valid: newValid.length,
          invalid: newInvalid.length,
        },
      };
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

    // Actually create the tenants
    const createdIds: string[] = [];

    for (const validRow of validationResult.valid) {
      const data = validRow.data;

      const tenant = await prisma.tenant.create({
        data: {
          organizationId: session.user.organizationId,
          fullName: trimString(data["Full Name"]),
          email: trimString(data.Email),
          phone: trimString(data.Phone),
          status: data.Status,
          preferEmail: data["Prefer Email"],
          preferWhatsapp: data["Prefer WhatsApp"],
          preferTelegram: data["Prefer Telegram"],
        },
      });

      createdIds.push(tenant.id);

      // Log activity
      await ActivityLogger.tenantCreated(session, tenant);
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
    return handleApiError(error, "bulk import tenants");
  }
}
