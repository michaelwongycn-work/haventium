"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  daysUntilExpiry: number | null;
  subscriptionStatus: string | null;
}

export function SubscriptionExpiryBanner({
  daysUntilExpiry,
  subscriptionStatus,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // Show if subscription is EXPIRED
  if (subscriptionStatus === "EXPIRED") {
    return (
      <div className="flex items-center justify-between gap-4 bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 text-sm text-destructive">
        <span>
          Your subscription has expired.{" "}
          <Link href="/subscribe" className="font-semibold underline underline-offset-2">
            Renew now
          </Link>{" "}
          to restore full access.
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    );
  }

  // Show warning when 7 or fewer days remain
  if (daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
    return (
      <div className="flex items-center justify-between gap-4 bg-yellow-50 border-b border-yellow-200 px-4 py-2.5 text-sm text-yellow-800 dark:bg-yellow-950/30 dark:border-yellow-800/40 dark:text-yellow-400">
        <span>
          Your subscription expires in{" "}
          <strong>{daysUntilExpiry} {daysUntilExpiry === 1 ? "day" : "days"}</strong>.{" "}
          <Link href="/subscribe" className="font-semibold underline underline-offset-2">
            Renew now
          </Link>{" "}
          to avoid interruption.
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-0.5 hover:bg-yellow-200/50 dark:hover:bg-yellow-800/30"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    );
  }

  return null;
}
