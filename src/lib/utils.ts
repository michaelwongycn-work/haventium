import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CURRENCY } from "./constants";

// ========================================
// TAILWIND UTILITIES
// ========================================

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// CURRENCY FORMATTING
// ========================================

/**
 * Format a number as currency
 * @param amount - The amount to format
 * @param currency - Currency code (default: IDR)
 * @param locale - Locale for formatting (default: id-ID)
 * @example
 * formatCurrency(1000000) // "Rp 1.000.000"
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = CURRENCY.DEFAULT,
  locale: string = CURRENCY.LOCALE,
): string {
  if (amount === null || amount === undefined) return "-";

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) return "-";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numAmount);
}

/**
 * Format a number as compact currency (e.g., 1.5M, 2.3K)
 * @param amount - The amount to format
 * @example
 * formatCompactCurrency(1500000) // "Rp 1.5M"
 */
export function formatCompactCurrency(
  amount: number | string | null | undefined,
  currency: string = CURRENCY.DEFAULT,
  locale: string = CURRENCY.LOCALE,
): string {
  if (amount === null || amount === undefined) return "-";

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) return "-";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(numAmount);
}

// ========================================
// NUMBER FORMATTING
// ========================================

/**
 * Format a number with thousand separators
 * @param num - The number to format
 * @example
 * formatNumber(1000000) // "1.000.000"
 */
export function formatNumber(
  num: number | string | null | undefined,
  locale: string = CURRENCY.LOCALE,
): string {
  if (num === null || num === undefined) return "-";

  const numValue = typeof num === "string" ? parseFloat(num) : num;

  if (isNaN(numValue)) return "-";

  return new Intl.NumberFormat(locale).format(numValue);
}

/**
 * Format a number as a percentage
 * @param value - The value to format (0-100 or 0-1)
 * @param decimals - Number of decimal places
 * @param isDecimal - Whether the value is already a decimal (0-1) or percentage (0-100)
 * @example
 * formatPercentage(75) // "75%"
 * formatPercentage(0.75, 1, true) // "75.0%"
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals: number = 0,
  isDecimal: boolean = false,
): string {
  if (value === null || value === undefined) return "-";

  const percentage = isDecimal ? value * 100 : value;

  return `${percentage.toFixed(decimals)}%`;
}

// ========================================
// STRING UTILITIES
// ========================================

/**
 * Truncate a string to a maximum length
 * @param str - The string to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add when truncated (default: "...")
 * @example
 * truncate("Hello World", 8) // "Hello..."
 */
export function truncate(
  str: string | null | undefined,
  maxLength: number,
  suffix: string = "...",
): string {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize the first letter of a string
 * @param str - The string to capitalize
 * @example
 * capitalize("hello world") // "Hello world"
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert a string to title case
 * @param str - The string to convert
 * @example
 * titleCase("hello world") // "Hello World"
 */
export function titleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Convert a string to slug format
 * @param str - The string to convert
 * @example
 * slugify("Hello World!") // "hello-world"
 */
export function slugify(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get initials from a name
 * @param name - The name to get initials from
 * @param maxInitials - Maximum number of initials (default: 2)
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("John Michael Doe", 3) // "JMD"
 */
export function getInitials(
  name: string | null | undefined,
  maxInitials: number = 2,
): string {
  if (!name) return "";

  return name
    .split(" ")
    .filter((word) => word.length > 0)
    .slice(0, maxInitials)
    .map((word) => word[0].toUpperCase())
    .join("");
}

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Check if a value is empty (null, undefined, empty string, empty array, empty object)
 * @param value - The value to check
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Check if a string is a valid email
 * @param email - The email to validate
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if a string is a valid phone number (Indonesian format)
 * @param phone - The phone number to validate
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  // Indonesian phone: starts with 08 or +62, 10-13 digits
  const phoneRegex = /^(\+62|62|0)[0-9]{9,12}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ""));
}

// ========================================
// ARRAY UTILITIES
// ========================================

/**
 * Remove duplicates from an array
 * @param arr - The array to deduplicate
 * @param key - Optional key to use for objects
 */
export function unique<T>(arr: T[], key?: keyof T): T[] {
  if (!key) return [...new Set(arr)];

  const seen = new Set();
  return arr.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * Group an array of objects by a key
 * @param arr - The array to group
 * @param key - The key to group by
 */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const groupKey = String(item[key]);
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

// ========================================
// MISC UTILITIES
// ========================================

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random string
 * @param length - Length of the string
 */
export function randomString(length: number = 10): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Clamp a number between min and max
 * @param value - The value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
