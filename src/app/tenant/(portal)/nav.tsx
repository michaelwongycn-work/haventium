"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Home01Icon,
  FileAttachmentIcon,
  FolderLibraryIcon,
  ToolsIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";

const navItems = [
  { href: "/tenant/dashboard", label: "Dashboard", icon: Home01Icon },
  { href: "/tenant/lease", label: "Lease", icon: FileAttachmentIcon },
  { href: "/tenant/documents", label: "Documents", icon: FolderLibraryIcon },
  { href: "/tenant/maintenance", label: "Maintenance", icon: ToolsIcon },
];

export default function TenantPortalNav({
  orgName,
}: {
  orgName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/tenant/auth/logout", { method: "POST" });
    router.push("/tenant/login");
  }

  return (
    <header className="border-b bg-background sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-sm">{orgName}</span>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <HugeiconsIcon icon={item.icon} size={15} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground"
            >
              <HugeiconsIcon icon={Logout01Icon} size={15} />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
