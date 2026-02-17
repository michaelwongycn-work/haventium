import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireAccess,
  apiSuccess,
  apiError,
  handleApiError,
  ActivityLogger,
} from "@/lib/api";

const bulkImportSchema = z.array(
  z.object({
    "Property Name": z.string().optional(),
    "Unit Name": z.string().optional(),
    Title: z.string().optional(),
    Description: z.string().optional(),
    Priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    "Estimated Cost": z.union([z.string(), z.number()]).optional(),
    // Support alternative column names (case-insensitive from Excel)
    propertyName: z.string().optional(),
    unitName: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    estimatedCost: z.union([z.string(), z.number()]).optional(),
  })
);

type MaintenanceRequestPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "maintenance",
      "create"
    );
    if (!authorized) return response;

    const body = await request.json();
    const validatedData = bulkImportSchema.parse(body);

    const results = {
      total: validatedData.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data: Record<string, unknown> }>,
    };

    for (let i = 0; i < validatedData.length; i++) {
      const row = validatedData[i];
      const rowNumber = i + 1;

      try {
        // Support both formats (capitalized and camelCase)
        const propertyName = (row["Property Name"] || row.propertyName) as string;
        const unitName = (row["Unit Name"] || row.unitName) as string | undefined;
        const title = (row["Title"] || row.title) as string;
        const description = (row["Description"] || row.description) as string;
        const priority = (row["Priority"] || row.priority || "MEDIUM") as MaintenanceRequestPriority;
        const estimatedCostRaw = row["Estimated Cost"] || row.estimatedCost;

        // Validate required fields
        if (!propertyName) {
          throw new Error("Property Name is required");
        }
        if (!title || title.trim().length < 5) {
          throw new Error("Title is required and must be at least 5 characters");
        }
        if (!description || description.trim().length < 10) {
          throw new Error("Description is required and must be at least 10 characters");
        }

        // Find property
        const property = await prisma.property.findFirst({
          where: {
            name: { equals: propertyName, mode: "insensitive" },
            organizationId: session.user.organizationId,
          },
        });

        if (!property) {
          throw new Error(`Property "${propertyName}" not found`);
        }

        // Find unit if specified
        let unit = null;
        if (unitName && unitName.trim()) {
          unit = await prisma.unit.findFirst({
            where: {
              name: { equals: unitName, mode: "insensitive" },
              propertyId: property.id,
            },
          });

          if (!unit) {
            throw new Error(`Unit "${unitName}" not found in property "${propertyName}"`);
          }
        }

        // Parse estimated cost
        let estimatedCost: number | null = null;
        if (estimatedCostRaw) {
          const parsed = typeof estimatedCostRaw === "string"
            ? parseFloat(estimatedCostRaw.replace(/[^0-9.-]/g, ""))
            : Number(estimatedCostRaw);

          if (!isNaN(parsed) && parsed >= 0) {
            estimatedCost = parsed;
          }
        }

        // Find active lease for the unit if unit is specified
        let tenantId: string | null = null;
        let leaseId: string | null = null;
        if (unit) {
          const activeLease = await prisma.leaseAgreement.findFirst({
            where: {
              unitId: unit.id,
              status: "ACTIVE",
              organizationId: session.user.organizationId,
            },
            select: {
              id: true,
              tenantId: true,
            },
          });

          if (activeLease) {
            tenantId = activeLease.tenantId;
            leaseId = activeLease.id;
          }
        }

        // Create maintenance request
        await prisma.maintenanceRequest.create({
          data: {
            title: title.trim(),
            description: description.trim(),
            propertyId: property.id,
            unitId: unit?.id || null,
            tenantId,
            leaseId,
            priority,
            status: "OPEN",
            estimatedCost,
            organizationId: session.user.organizationId,
          },
        });

        // Log activity
        await ActivityLogger.maintenanceRequestCreated(
          session,
          {
            id: "bulk-import",
            title: title.trim(),
            propertyId: property.id,
          },
          {
            propertyName: property.name,
            unitName: unit?.name,
          }
        );

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          error: error instanceof Error ? error.message : "Unknown error",
          data: row as Record<string, unknown>,
        });
      }
    }

    return apiSuccess(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("Invalid data format. Please check your Excel file.", 400);
    }
    return handleApiError(error, "bulk import maintenance requests");
  }
}
