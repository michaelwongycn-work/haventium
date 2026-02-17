/**
 * Application-wide constants
 * Centralized source of truth for all constant values used across the application
 */

// ========================================
// AUTHENTICATION & SECURITY
// ========================================

export const AUTH = {
  SALT_ROUNDS: 10,
  SESSION_STRATEGY: "jwt" as const,
  LOGIN_PATH: "/login",
} as const;

// ========================================
// SUBSCRIPTION STATUS
// ========================================

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  TRIAL: "TRIAL",
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

// ========================================
// LEASE STATUS
// ========================================

export const LEASE_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  CANCELLED: "CANCELLED",
} as const;

export type LeaseStatus = (typeof LEASE_STATUS)[keyof typeof LEASE_STATUS];

// ========================================
// TENANT STATUS
// ========================================

export const TENANT_STATUS = {
  LEAD: "LEAD",
  BOOKED: "BOOKED",
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
} as const;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];

// ========================================
// PAYMENT STATUS
// ========================================

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// ========================================
// PAYMENT METHOD
// ========================================

export const PAYMENT_METHOD = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
  VIRTUAL_ACCOUNT: "VIRTUAL_ACCOUNT",
  QRIS: "QRIS",
  MANUAL: "MANUAL",
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

// ========================================
// DEPOSIT STATUS
// ========================================

export const DEPOSIT_STATUS = {
  HELD: "HELD",
  RETURNED: "RETURNED",
  FORFEITED: "FORFEITED",
} as const;

export type DepositStatus =
  (typeof DEPOSIT_STATUS)[keyof typeof DEPOSIT_STATUS];

// ========================================
// PAYMENT CYCLE
// ========================================

export const PAYMENT_CYCLE = {
  DAILY: "DAILY",
  MONTHLY: "MONTHLY",
  ANNUAL: "ANNUAL",
} as const;

export type PaymentCycle = (typeof PAYMENT_CYCLE)[keyof typeof PAYMENT_CYCLE];

// ========================================
// ACTIVITY TYPES
// ========================================

export const ACTIVITY_TYPE = {
  TENANT_CREATED: "TENANT_CREATED",
  TENANT_UPDATED: "TENANT_UPDATED",
  TENANT_STATUS_CHANGED: "TENANT_STATUS_CHANGED",
  LEASE_CREATED: "LEASE_CREATED",
  LEASE_UPDATED: "LEASE_UPDATED",
  LEASE_TERMINATED: "LEASE_TERMINATED",
  PAYMENT_RECORDED: "PAYMENT_RECORDED",
  PAYMENT_UPDATED: "PAYMENT_UPDATED",
  DEPOSIT_CREATED: "DEPOSIT_CREATED",
  DEPOSIT_RETURNED: "DEPOSIT_RETURNED",
  NOTIFICATION_SENT: "NOTIFICATION_SENT",
  PROPERTY_CREATED: "PROPERTY_CREATED",
  PROPERTY_UPDATED: "PROPERTY_UPDATED",
  UNIT_CREATED: "UNIT_CREATED",
  UNIT_UPDATED: "UNIT_UPDATED",
  USER_LOGIN: "USER_LOGIN",
  OTHER: "OTHER",
} as const;

export type ActivityType = (typeof ACTIVITY_TYPE)[keyof typeof ACTIVITY_TYPE];

// ========================================
// NOTIFICATION
// ========================================

export const NOTIFICATION_CHANNEL = {
  EMAIL: "EMAIL",
  WHATSAPP: "WHATSAPP",
  TELEGRAM: "TELEGRAM",
} as const;

export type NotificationChannel =
  (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

export const NOTIFICATION_TRIGGER = {
  PAYMENT_REMINDER: "PAYMENT_REMINDER",
  PAYMENT_LATE: "PAYMENT_LATE",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  LEASE_EXPIRING: "LEASE_EXPIRING",
  LEASE_EXPIRED: "LEASE_EXPIRED",
  MANUAL: "MANUAL",
} as const;

export type NotificationTrigger =
  (typeof NOTIFICATION_TRIGGER)[keyof typeof NOTIFICATION_TRIGGER];

export const NOTIFICATION_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;

export type NotificationStatus =
  (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

// ========================================
// ACCESS CONTROL RESOURCES
// ========================================

export const RESOURCE = {
  PROPERTIES: "properties",
  UNITS: "units",
  TENANTS: "tenants",
  LEASES: "leases",
  USERS: "users",
  ROLES: "roles",
  SETTINGS: "settings",
  REPORTS: "reports",
  NOTIFICATIONS: "notifications",
} as const;

export type Resource = (typeof RESOURCE)[keyof typeof RESOURCE];

// ========================================
// ACCESS CONTROL ACTIONS
// ========================================

export const ACTION = {
  READ: "read",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  MANAGE: "manage",
} as const;

export type Action = (typeof ACTION)[keyof typeof ACTION];

// ========================================
// HTTP STATUS CODES
// ========================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

// ========================================
// DATE & TIME
// ========================================

export const DATE_FORMAT = {
  SHORT: "MMM d, yyyy",
  LONG: "MMMM d, yyyy",
  WITH_TIME: "MMM d, yyyy h:mm a",
  ISO: "yyyy-MM-dd",
} as const;

export const TIME_FORMAT = {
  SHORT: "h:mm a",
  LONG: "h:mm:ss a",
  MILITARY: "HH:mm",
} as const;

// ========================================
// CURRENCY
// ========================================

export const CURRENCY = {
  DEFAULT: "IDR",
  LOCALE: "id-ID",
} as const;
