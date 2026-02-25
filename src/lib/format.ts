import { format as dateFnsFormat } from "date-fns";

// Default formats (can be overridden by organization settings)
let defaultDateFormat = "dd/MM/yyyy";
let defaultCurrency = "USD";

const CURRENCY_SYMBOLS: Record<string, string> = {
  // Southeast Asia
  IDR: "Rp",
  MYR: "RM",
  SGD: "S$",
  THB: "฿",
  PHP: "₱",
  VND: "₫",
  MMK: "K",
  KHR: "៛",
  LAK: "₭",
  BND: "B$",
  // Major global
  USD: "$",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF",
  JPY: "¥",
  CNY: "¥",
  HKD: "HK$",
  KRW: "₩",
  INR: "₹",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Set global format preferences (should be called on app initialization with org settings)
 */
export function setFormatPreferences(preferences: {
  dateFormat?: string;
  currency?: string;
}) {
  if (preferences.dateFormat) defaultDateFormat = preferences.dateFormat;
  if (preferences.currency) defaultCurrency = preferences.currency;
}

/**
 * Get current format preferences
 */
export function getFormatPreferences() {
  return {
    dateFormat: defaultDateFormat,
    currency: defaultCurrency,
    currencySymbol: getCurrencySymbol(defaultCurrency),
  };
}

/**
 * Format a date using organization's date format preference
 * @param date - Date string, Date object, or timestamp
 * @param customFormat - Optional custom format to override organization default
 * @returns Formatted date string (e.g., "15/02/2026")
 */
export function formatDate(date: string | Date | number, customFormat?: string): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(dateObj, customFormat || defaultDateFormat);
}

/**
 * Format a date to full format with day name
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string (e.g., "Saturday, 15/02/2026")
 */
export function formatDateLong(date: string | Date | number): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(dateObj, "EEEE, dd/MM/yyyy");
}

/**
 * Format a date to short month format
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string (e.g., "15 Feb")
 */
export function formatDateShort(date: string | Date | number): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(dateObj, "dd MMM");
}

/**
 * Format a date to month and year
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string (e.g., "Feb 2026")
 */
export function formatMonthYear(date: string | Date | number): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(dateObj, "MMM yyyy");
}

/**
 * Format currency value using organization's currency preference
 * @param value - Number or string to format
 * @param options - Optional formatting options
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options?: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  const currency = options?.currency || defaultCurrency;
  const symbol = getCurrencySymbol(currency);
  if (value === null || value === undefined) return `${symbol}0.00`;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return `${symbol}0.00`;

  const formatted = new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(num);

  return `${symbol}${formatted}`;
}
