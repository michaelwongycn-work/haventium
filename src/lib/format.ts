import { format as dateFnsFormat } from "date-fns";

/**
 * Format a date to dd/MM/yyyy format
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string (e.g., "15/02/2026")
 */
export function formatDate(date: string | Date | number): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(dateObj, "dd/MM/yyyy");
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
 * Format currency value
 * @param value - Number or string to format
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined) return "$0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(num);
}
