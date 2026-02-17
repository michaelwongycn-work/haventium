import { z } from "zod";
import type { FieldValues, Resolver } from "react-hook-form";

/**
 * Custom Zod resolver for react-hook-form that's compatible with Zod v4
 */
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

      const errors: Record<string, any> = {};

      result.error.issues.forEach((error: any) => {
        const path = error.path.join(".");
        if (!errors[path]) {
          errors[path] = {
            type: error.code,
            message: error.message,
          };
        }
      });

      return {
        values: {},
        errors,
      };
    } catch (error) {
      console.error("Validation failed:", error);
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
