import { z } from "zod";

export type ValidationResult<T> = {
  rowIndex: number;
  data: T;
  errors: string[];
};

export type BulkValidationResult<T> = {
  valid: ValidationResult<T>[];
  invalid: ValidationResult<T>[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
};

/**
 * Validate bulk data against a Zod schema
 */
export function validateBulkData<T>(
  rows: unknown[],
  schema: z.ZodSchema<T>
): BulkValidationResult<T> {
  const valid: ValidationResult<T>[] = [];
  const invalid: ValidationResult<T>[] = [];

  rows.forEach((row, index) => {
    const result = schema.safeParse(row);

    if (result.success) {
      valid.push({
        rowIndex: index + 2, // +2 because Excel is 1-indexed and first row is header
        data: result.data,
        errors: [],
      });
    } else {
      invalid.push({
        rowIndex: index + 2,
        data: row as T,
        errors: result.error.issues.map(
          (err) => `${err.path.join(".")}: ${err.message}`
        ),
      });
    }
  });

  return {
    valid,
    invalid,
    summary: {
      total: rows.length,
      valid: valid.length,
      invalid: invalid.length,
    },
  };
}

/**
 * Check for duplicate values in a specific field
 */
export function checkDuplicates<T>(
  rows: T[],
  fieldGetter: (row: T) => string | undefined
): Map<string, number[]> {
  const duplicates = new Map<string, number[]>();
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const value = fieldGetter(row);
    if (!value) return;

    const normalized = value.toLowerCase().trim();
    if (seen.has(normalized)) {
      const firstIndex = seen.get(normalized)!;
      if (!duplicates.has(normalized)) {
        duplicates.set(normalized, [firstIndex]);
      }
      duplicates.get(normalized)!.push(index);
    } else {
      seen.set(normalized, index);
    }
  });

  return duplicates;
}

/**
 * Add duplicate errors to validation results
 */
export function addDuplicateErrors<T>(
  results: BulkValidationResult<T>,
  duplicates: Map<string, number[]>,
  fieldName: string
): BulkValidationResult<T> {
  const invalidRowIndices = new Set<number>();

  duplicates.forEach((indices) => {
    indices.forEach((index) => {
      invalidRowIndices.add(index);
    });
  });

  const newValid: ValidationResult<T>[] = [];
  const newInvalid: ValidationResult<T>[] = [...results.invalid];

  results.valid.forEach((result) => {
    const arrayIndex = result.rowIndex - 2; // Convert back to array index
    if (invalidRowIndices.has(arrayIndex)) {
      newInvalid.push({
        ...result,
        errors: [`${fieldName}: Duplicate value found in import file`],
      });
    } else {
      newValid.push(result);
    }
  });

  return {
    valid: newValid,
    invalid: newInvalid,
    summary: {
      total: results.summary.total,
      valid: newValid.length,
      invalid: newInvalid.length,
    },
  };
}
