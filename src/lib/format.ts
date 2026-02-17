import { format as dateFnsFormat } from "date-fns";

// Default formats (can be overridden by organization settings)
let defaultDateFormat = "dd/MM/yyyy";
let defaultCurrency = "USD";
let defaultCurrencySymbol = "$";

/**
 * Set global format preferences (should be called on app initialization with org settings)
 */
export function setFormatPreferences(preferences: {
  dateFormat?: string;
  currency?: string;
  currencySymbol?: string;
}) {
  if (preferences.dateFormat) defaultDateFormat = preferences.dateFormat;
  if (preferences.currency) defaultCurrency = preferences.currency;
  if (preferences.currencySymbol) defaultCurrencySymbol = preferences.currencySymbol;
}

/**
 * Get current format preferences
 */
export function getFormatPreferences() {
  return {
    dateFormat: defaultDateFormat,
    currency: defaultCurrency,
    currencySymbol: defaultCurrencySymbol,
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
    symbol?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  if (value === null || value === undefined) return `${options?.symbol || defaultCurrencySymbol}0.00`;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return `${options?.symbol || defaultCurrencySymbol}0.00`;

  const currency = options?.currency || defaultCurrency;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(num);
}
