import { z } from "zod";
import {
  requireAccess,
  handleApiError,
  ActivityLogger,
  apiSuccess,
  apiError,
  checkSubscriptionLimit,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  validateBulkData,
  checkDuplicates,
  addDuplicateErrors,
} from "@/lib/bulk-validation";
import { parseBooleanField, trimString } from "@/lib/excel-utils";

// Zod schema for bulk property import
const bulkPropertySchema = z
  .object({
    "Property Name": z.string().min(1, "Property name is required").max(255),
    "Unit Name": z.string().min(1, "Unit name is required").max(100),
    "Daily Rate": z.number().min(0).optional().nullable(),
    "Monthly Rate": z.number().min(0).optional().nullable(),
    "Annual Rate": z.number().min(0).optional().nullable(),
    "Is Unavailable": z
      .union([z.boolean(), z.string()])
      .transform((val) => parseBooleanField(val))
      .optional()
      .default(false),
  })
  .refine(
    (data) => data["Daily Rate"] || data["Monthly Rate"] || data["Annual Rate"],
    { message: "At least one rate must be provided" }
  );

type BulkPropertyInput = z.infer<typeof bulkPropertySchema>;

// Request schema
const requestSchema = z.object({
  dryRun: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.unknown())),
});

// POST /api/properties/bulk-import
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "properties",
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
    let validationResult = validateBulkData(rows, bulkPropertySchema);

    // Check for duplicate (Property Name + Unit Name) within the import file
    const duplicateUnits = checkDuplicates(
      validationResult.valid.map((v) => v.data),
      (row) => `${row["Property Name"]}::${row["Unit Name"]}`
    );

    if (duplicateUnits.size > 0) {
      validationResult = addDuplicateErrors(
        validationResult,
        duplicateUnits,
        "Unit"
      );
    }

    // Check for existing unit names in database (only for valid rows)
    if (validationResult.valid.length > 0) {
      // Group rows by property name to minimize queries
      const propertiesByName = new Map<string, BulkPropertyInput[]>();
      validationResult.valid.forEach((v) => {
        const propertyName = v.data["Property Name"].toLowerCase().trim();
        if (!propertiesByName.has(propertyName)) {
          propertiesByName.set(propertyName, []);
        }
        propertiesByName.get(propertyName)!.push(v.data);
      });

      // Fetch existing properties and their units
      const propertyNames = Array.from(propertiesByName.keys());
      const existingProperties = await prisma.property.findMany({
        where: {
          organizationId: session.user.organizationId,
          name: {
            in: propertyNames,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          units: {
            select: {
              name: true,
            },
          },
        },
      });

      // Build a map of existing unit names per property
      const existingUnitsMap = new Map<string, Set<string>>();
      existingProperties.forEach((property) => {
        const propertyNameKey = property.name.toLowerCase();
        const unitNames = new Set(
          property.units.map((u) => u.name.toLowerCase().trim())
        );
        existingUnitsMap.set(propertyNameKey, unitNames);
      });

      // Check each valid row against existing units
      const newValid = [];
      const newInvalid = [...validationResult.invalid];

      for (const validRow of validationResult.valid) {
        const propertyName = validRow.data["Property Name"]
          .toLowerCase()
          .trim();
        const unitName = validRow.data["Unit Name"].toLowerCase().trim();

        const existingUnits = existingUnitsMap.get(propertyName);
        if (existingUnits && existingUnits.has(unitName)) {
          newInvalid.push({
            ...validRow,
            errors: [
              "Unit: Unit name already exists in database for this property",
            ],
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
    }

    // Calculate how many new properties and units would be created
    if (validationResult.valid.length > 0) {
      const uniquePropertyNames = new Set(
        validationResult.valid.map((v) =>
          v.data["Property Name"].toLowerCase().trim()
        )
      );

      // Count existing properties
      const existingPropertiesCount = await prisma.property.count({
        where: {
          organizationId: session.user.organizationId,
          name: {
            in: Array.from(uniquePropertyNames),
            mode: "insensitive",
          },
        },
      });

      const newPropertiesCount =
        uniquePropertyNames.size - existingPropertiesCount;

      // Check subscription limits
      if (newPropertiesCount > 0) {
        const limitCheck = await checkSubscriptionLimit(
          session,
          "properties"
        );

        if (!limitCheck.allowed && limitCheck.error) {
          return limitCheck.error;
        }

        // Also check if adding these properties would exceed limit
        const currentCount = limitCheck.current || 0;
        const maxAllowed = limitCheck.max || -1;
        if (maxAllowed !== -1 && currentCount + newPropertiesCount > maxAllowed) {
          return apiError(
            `Subscription limit exceeded: Maximum ${maxAllowed} properties allowed on ${session.user.subscription?.tier?.name} tier`,
            403
          );
        }
      }

      // Check units limit
      const unitLimitCheck = await checkSubscriptionLimit(
        session,
        "units"
      );

      if (!unitLimitCheck.allowed && unitLimitCheck.error) {
        return unitLimitCheck.error;
      }

      // Check if adding these units would exceed limit
      const currentUnitsCount = unitLimitCheck.current || 0;
      const maxUnitsAllowed = unitLimitCheck.max || -1;
      if (maxUnitsAllowed !== -1 && currentUnitsCount + validationResult.valid.length > maxUnitsAllowed) {
        return apiError(
          `Subscription limit exceeded: Maximum ${maxUnitsAllowed} units allowed on ${session.user.subscription?.tier?.name} tier`,
          403
        );
      }
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

    // Actually create the properties and units
    const createdPropertyIds: string[] = [];
    const createdUnitIds: string[] = [];

    // Group rows by property name
    const propertiesByName = new Map<string, BulkPropertyInput[]>();
    validationResult.valid.forEach((v) => {
      const propertyName = v.data["Property Name"].toLowerCase().trim();
      if (!propertiesByName.has(propertyName)) {
        propertiesByName.set(propertyName, []);
      }
      propertiesByName.get(propertyName)!.push(v.data);
    });

    // Create/find properties and add units
    for (const [, units] of propertiesByName.entries()) {
      const propertyName = units[0]["Property Name"]; // Use original casing from first row

      // Find or create property
      let property = await prisma.property.findFirst({
        where: {
          organizationId: session.user.organizationId,
          name: {
            equals: propertyName,
            mode: "insensitive",
          },
        },
      });

      if (!property) {
        // Create new property
        property = await prisma.property.create({
          data: {
            organizationId: session.user.organizationId,
            name: trimString(propertyName),
          },
        });

        createdPropertyIds.push(property.id);

        // Log property creation
        await ActivityLogger.propertyCreated(session, property);
      }

      // Create units for this property
      for (const unitData of units) {
        const unit = await prisma.unit.create({
          data: {
            propertyId: property.id,
            name: trimString(unitData["Unit Name"]),
            dailyRate: unitData["Daily Rate"] ?? null,
            monthlyRate: unitData["Monthly Rate"] ?? null,
            annualRate: unitData["Annual Rate"] ?? null,
            isUnavailable: unitData["Is Unavailable"],
          },
        });

        createdUnitIds.push(unit.id);

        // Log unit creation
        await ActivityLogger.unitCreated(
          session,
          {
            id: unit.id,
            name: unit.name,
            propertyId: property.id,
          },
          property.name
        );
      }
    }

    return apiSuccess({
      summary: {
        ...validationResult.summary,
        created: createdUnitIds.length,
        createdProperties: createdPropertyIds.length,
        createdUnits: createdUnitIds.length,
      },
      validRows: validationResult.valid,
      invalidRows: validationResult.invalid,
      createdIds: [...createdPropertyIds, ...createdUnitIds],
    });
  } catch (error) {
    return handleApiError(error, "bulk import properties");
  }
}
