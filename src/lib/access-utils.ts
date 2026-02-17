/**
 * Client-side utility for checking user permissions
 * Can be safely imported in both server and client components
 */

/**
 * Type definition for user roles with access permissions
 * Matches the structure returned from the database
 */
export type UserRole = {
  roleAccesses?: Array<{
    access: {
      resource: string
      action: string
    }
  }>
}

/**
 * Check if user has permission to perform an action on a resource
 * This is the centralized access control logic used throughout the application
 * @param roles - Array of user roles with their access permissions
 * @param resource - The resource to check access for (e.g., "properties", "users", "leases")
 * @param action - The action to check (e.g., "read", "create", "update", "delete", "manage")
 * @returns true if user has access, false otherwise
 * @example
 * ```ts
 * const canEdit = hasAccess(user.roles, "properties", "update")
 * if (canEdit) {
 *   // Show edit button
 * }
 * ```
 */
export function hasAccess(roles: UserRole[], resource: string, action: string): boolean {
  return roles.some((role) =>
    role.roleAccesses?.some(
      (ra) =>
        ra.access.resource === resource && ra.access.action === action
    )
  )
}
