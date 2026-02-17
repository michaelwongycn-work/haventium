import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasAccess, type UserRole } from "@/lib/access-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";

// Re-export for convenience
export { hasAccess, type UserRole };

/**
 * Server-side access control for page components
 * Checks if the authenticated user has permission to view a page
 * Redirects to login if not authenticated
 * @param resource - The resource to check access for (e.g., "properties", "users")
 * @param action - The action to check (e.g., "read", "create", "update", "delete")
 * @returns Object with authorization status, session, and user roles
 * @example
 * ```tsx
 * const { authorized, session, roles } = await checkPageAccess("properties", "read")
 * if (!authorized) return <AccessDenied resource="properties" />
 * ```
 */
export async function checkPageAccess(resource: string, action: string) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const roles = session.user.roles || [];
  const authorized = hasAccess(roles, resource, action);

  return { authorized, session, roles };
}

// ========================================
// UI COMPONENTS
// ========================================

/**
 * UI component to display when user doesn't have access to a resource
 * @param resource - The name of the resource that was denied
 * @example
 * ```tsx
 * if (!authorized) {
 *   return <AccessDenied resource="properties" />
 * }
 * ```
 */
export function AccessDenied({ resource }: { resource: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              className="h-5 w-5 text-destructive"
            />
            <CardTitle>Access Denied</CardTitle>
          </div>
          <CardDescription>
            You don&apos;t have permission to access {resource}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please contact your administrator if you believe you should have
            access to this resource.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
