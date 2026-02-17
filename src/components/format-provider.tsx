"use client";

import { useEffect } from "react";
import { setFormatPreferences } from "@/lib/format";

export function FormatProvider({
  dateFormat,
  currency,
  currencySymbol,
  children,
}: {
  dateFormat: string;
  currency: string;
  currencySymbol: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    setFormatPreferences({
      dateFormat,
      currency,
      currencySymbol,
    });
  }, [dateFormat, currency, currencySymbol]);

  return <>{children}</>;
}
