import { z } from "zod";

/**
 * Request Validation Utilities
 * Helpers for validating and parsing request data
 */

export async function validateRequest<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  const body = await request.json();
  return schema.parse(body);
}

export function validateSearchParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> {
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
}

/**
 * Sanitize search input to prevent injection attacks
 */
export function sanitizeSearchInput(input: string | null): string | undefined {
  if (!input) return undefined;

  // Remove special characters that could be used for injection
  // Keep alphanumeric, spaces, and common punctuation
  return input
    .trim()
    .replace(/[^\w\s@.\-+()]/g, "")
    .slice(0, 100); // Limit length
}

/**
 * Parse and validate enum values from query params
 */
export function parseEnumParam<T extends string>(
  value: string | null,
  allowedValues: readonly T[],
): T | undefined {
  if (!value) return undefined;
  if (allowedValues.includes(value as T)) {
    return value as T;
  }
  return undefined;
}
