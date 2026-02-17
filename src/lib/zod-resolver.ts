import { z } from "zod";
import type { FieldValues, Resolver } from "react-hook-form";

/**
 * Custom Zod resolver for react-hook-form that's compatible with Zod v4
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function zodResolver<T extends z.ZodType<any, any, any>>(
  schema: T,
): Resolver<z.infer<T>> {
  return async (values: FieldValues) => {
    try {
      const result = await schema.safeParseAsync(values);

      if (result.success) {
        return {
          values: result.data,
          errors: {},
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errors: Record<string, any> = {};

      result.error.issues.forEach((issue: z.ZodIssue) => {
        const path = issue.path.join(".");
        if (!errors[path]) {
          errors[path] = {
            type: issue.code,
            message: issue.message,
          };
        }
      });

      return {
        values: {},
        errors,
      };
    } catch (error) {
      return {
        values: {},
        errors: {
          root: {
            type: "manual",
            message: "Validation failed",
          },
        },
      };
    }
  };
}
