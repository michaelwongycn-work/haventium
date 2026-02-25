"use client";

import { useEffect } from "react";
import { setFormatPreferences } from "@/lib/format";

export function FormatProvider({
  dateFormat,
  currency,
  children,
}: {
  dateFormat: string;
  currency: string;
  children: React.ReactNode;
}) {
  // Set synchronously so formatCurrency calls during initial render use the correct currency
  setFormatPreferences({ dateFormat, currency });

  useEffect(() => {
    setFormatPreferences({ dateFormat, currency });
  }, [dateFormat, currency]);

  return <>{children}</>;
}
