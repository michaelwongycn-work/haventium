"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasAccess, type UserRole } from "@/lib/access-utils";

interface NavLinksProps {
  roles: UserRole[];
}

export function NavLinks({ roles }: NavLinksProps) {
  const pathname = usePathname();

  // Build links based on permissions
  const links = [
    { href: "/dashboard", label: "Dashboard" }, // Always visible
  ];

  // Properties
  if (hasAccess(roles, "properties", "read")) {
    links.push({ href: "/properties", label: "Properties" });
  }

  // Tenants
  if (hasAccess(roles, "tenants", "read")) {
    links.push({ href: "/tenants", label: "Tenants" });
  }

  // Leases
  if (hasAccess(roles, "leases", "read")) {
    links.push({ href: "/leases", label: "Leases" });
  }

  // Maintenance Requests
  if (hasAccess(roles, "maintenance", "read")) {
    links.push({ href: "/maintenance-requests", label: "Maintenance" });
  }

  // Documents
  if (hasAccess(roles, "documents", "read")) {
    links.push({ href: "/documents", label: "Documents" });
  }

  // Notifications
  if (hasAccess(roles, "notifications", "read")) {
    links.push({ href: "/notifications", label: "Notifications" });
  }

  // Settings
  if (
    hasAccess(roles, "settings", "manage") ||
    hasAccess(roles, "users", "manage")
  ) {
    links.push({ href: "/settings", label: "Settings" });
  }

  return (
    <>
      {links.map((link) => {
        const isActive =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium transition-colors hover:text-primary ${
              isActive ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
