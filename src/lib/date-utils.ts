/**
 * Date and time utility functions
 * Specialized utilities for lease management, date calculations, and formatting
 */

import { format, formatDistance, formatRelative, addDays, addMonths, addYears, differenceInDays, differenceInMonths, differenceInYears, isAfter, isBefore, isWithinInterval, startOfDay, endOfDay, parseISO } from "date-fns"

// ========================================
// DATE FORMATTING
// ========================================

/**
 * Format a date to a readable string
 * @param date - Date to format
 * @param formatStr - Format string (default: "MMM d, yyyy")
 * @example
 * formatDate(new Date()) // "Jan 15, 2024"
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = "MMM d, yyyy"
): string {
  if (!date) return "-"
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return format(dateObj, formatStr)
}

/**
 * Format a date with time
 * @param date - Date to format
 * @example
 * formatDateTime(new Date()) // "Jan 15, 2024 3:30 PM"
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, "MMM d, yyyy h:mm a")
}

/**
 * Format a date range
 * @param startDate - Start date
 * @param endDate - End date
 * @example
 * formatDateRange(start, end) // "Jan 15, 2024 - Feb 15, 2024"
 */
export function formatDateRange(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined
): string {
  if (!startDate || !endDate) return "-"
  return `${formatDate(startDate)} - ${formatDate(endDate)}`
}

/**
 * Format a date relative to now
 * @param date - Date to format
 * @example
 * formatRelativeDate(pastDate) // "2 days ago"
 */
export function formatRelativeDate(date: Date | string | null | undefined): string {
  if (!date) return "-"
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return formatDistance(dateObj, new Date(), { addSuffix: true })
}

/**
 * Format a date relative to now with context
 * @param date - Date to format
 * @example
 * formatRelativeDateWithContext(date) // "yesterday at 3:30 PM"
 */
export function formatRelativeDateWithContext(date: Date | string | null | undefined): string {
  if (!date) return "-"
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return formatRelative(dateObj, new Date())
}

// ========================================
// DATE CALCULATIONS
// ========================================

/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add
 */
export function addDaysToDate(date: Date | string, days: number): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return addDays(dateObj, days)
}

/**
 * Add months to a date
 * @param date - Starting date
 * @param months - Number of months to add
 */
export function addMonthsToDate(date: Date | string, months: number): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return addMonths(dateObj, months)
}

/**
 * Add years to a date
 * @param date - Starting date
 * @param years - Number of years to add
 */
export function addYearsToDate(date: Date | string, years: number): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return addYears(dateObj, years)
}

/**
 * Calculate the number of days between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of days (can be negative if endDate is before startDate)
 */
export function daysBetween(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate
  return differenceInDays(end, start)
}

/**
 * Calculate the number of months between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of months
 */
export function monthsBetween(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate
  return differenceInMonths(end, start)
}

/**
 * Calculate the number of years between two dates
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of years
 */
export function yearsBetween(
  startDate: Date | string,
  endDate: Date | string
): number {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate
  return differenceInYears(end, start)
}

// ========================================
// DATE COMPARISONS
// ========================================

/**
 * Check if a date is in the past
 * @param date - Date to check
 */
export function isPast(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return isBefore(dateObj, new Date())
}

/**
 * Check if a date is in the future
 * @param date - Date to check
 */
export function isFuture(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return isAfter(dateObj, new Date())
}

/**
 * Check if a date is today
 * @param date - Date to check
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  const today = startOfDay(new Date())
  const checkDate = startOfDay(dateObj)
  return checkDate.getTime() === today.getTime()
}

/**
 * Check if a date is within a range
 * @param date - Date to check
 * @param start - Range start
 * @param end - Range end
 */
export function isDateInRange(
  date: Date | string,
  start: Date | string,
  end: Date | string
): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  const startObj = typeof start === "string" ? parseISO(start) : start
  const endObj = typeof end === "string" ? parseISO(end) : end
  
  return isWithinInterval(dateObj, { start: startObj, end: endObj })
}

// ========================================
// LEASE-SPECIFIC UTILITIES
// ========================================

/**
 * Calculate lease end date based on start date and payment cycle
 * @param startDate - Lease start date
 * @param paymentCycle - Payment cycle ("DAILY", "MONTHLY", "ANNUAL")
 * @param periods - Number of periods (default: 1)
 * @example
 * calculateLeaseEndDate(new Date(), "MONTHLY", 12) // 1 year lease
 */
export function calculateLeaseEndDate(
  startDate: Date | string,
  paymentCycle: "DAILY" | "MONTHLY" | "ANNUAL",
  periods: number = 1
): Date {
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate
  
  switch (paymentCycle) {
    case "DAILY":
      return addDays(start, periods)
    case "MONTHLY":
      return addMonths(start, periods)
    case "ANNUAL":
      return addYears(start, periods)
    default:
      return start
  }
}

/**
 * Check if a date is within the grace period
 * @param targetDate - Date to check (e.g., lease end date)
 * @param gracePeriodDays - Number of grace period days
 * @param referenceDate - Reference date (default: today)
 * @returns True if within grace period
 * @example
 * isWithinGracePeriod(leaseEndDate, 7) // Check if within 7-day grace period
 */
export function isWithinGracePeriod(
  targetDate: Date | string,
  gracePeriodDays: number,
  referenceDate: Date | string = new Date()
): boolean {
  const target = typeof targetDate === "string" ? parseISO(targetDate) : targetDate
  const reference = typeof referenceDate === "string" ? parseISO(referenceDate) : referenceDate
  
  const graceEndDate = addDays(target, gracePeriodDays)
  
  return isWithinInterval(reference, {
    start: target,
    end: graceEndDate,
  })
}

/**
 * Calculate days remaining until a date
 * @param targetDate - Target date
 * @param fromDate - Starting date (default: today)
 * @returns Number of days remaining (negative if past)
 */
export function daysRemaining(
  targetDate: Date | string,
  fromDate: Date | string = new Date()
): number {
  return daysBetween(fromDate, targetDate)
}

/**
 * Check if a lease is expiring soon
 * @param endDate - Lease end date
 * @param warningDays - Number of days before expiry to warn (default: 30)
 * @returns True if expiring within warning period
 */
export function isLeaseExpiringSoon(
  endDate: Date | string,
  warningDays: number = 30
): boolean {
  const remaining = daysRemaining(endDate)
  return remaining > 0 && remaining <= warningDays
}

/**
 * Check if a lease has expired
 * @param endDate - Lease end date
 * @param gracePeriodDays - Grace period days (default: 0)
 * @returns True if expired (including grace period)
 */
export function isLeaseExpired(
  endDate: Date | string,
  gracePeriodDays: number = 0
): boolean {
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate
  const graceEnd = addDays(end, gracePeriodDays)
  return isPast(graceEnd)
}

/**
 * Get lease status based on dates
 * @param startDate - Lease start date
 * @param endDate - Lease end date
 * @param gracePeriodDays - Grace period days (default: 0)
 * @returns Lease status: "upcoming", "active", "grace", or "expired"
 */
export function getLeaseStatus(
  startDate: Date | string,
  endDate: Date | string,
  gracePeriodDays: number = 0
): "upcoming" | "active" | "grace" | "expired" {
  const now = new Date()
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate
  
  if (isBefore(now, start)) {
    return "upcoming"
  }
  
  if (isWithinInterval(now, { start, end })) {
    return "active"
  }
  
  if (isWithinGracePeriod(end, gracePeriodDays, now)) {
    return "grace"
  }
  
  return "expired"
}

/**
 * Calculate auto-renewal notice date
 * @param endDate - Lease end date
 * @param noticeDays - Number of days before end date to send notice
 * @returns Notice date
 */
export function calculateAutoRenewalNoticeDate(
  endDate: Date | string,
  noticeDays: number
): Date {
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate
  return addDays(end, -noticeDays)
}

/**
 * Check if it's time to send auto-renewal notice
 * @param endDate - Lease end date
 * @param noticeDays - Number of days before end date to send notice
 * @returns True if notice should be sent
 */
export function shouldSendAutoRenewalNotice(
  endDate: Date | string,
  noticeDays: number
): boolean {
  const noticeDate = calculateAutoRenewalNoticeDate(endDate, noticeDays)
  return isToday(noticeDate) || isPast(noticeDate)
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get start of day for a date
 * @param date - Date
 */
export function getStartOfDay(date: Date | string): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return startOfDay(dateObj)
}

/**
 * Get end of day for a date
 * @param date - Date
 */
export function getEndOfDay(date: Date | string): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date
  return endOfDay(dateObj)
}

/**
 * Parse ISO date string to Date object
 * @param dateString - ISO date string
 */
export function parseDate(dateString: string): Date {
  return parseISO(dateString)
}

/**
 * Convert Date to ISO string
 * @param date - Date object
 */
export function toISOString(date: Date): string {
  return date.toISOString()
}
