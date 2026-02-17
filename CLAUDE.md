# Haventium

Rental property management CRM. Multi-tenant SaaS where every piece of data is scoped to an organization — every Prisma query must include `organizationId` in its `where` clause.

## Development Rules

- **Never run Prisma migrations** (`prisma migrate dev`, `prisma db push`, etc.) — the developer handles all migrations manually.
- **Use pnpm** for package management (not npm or bun).

## Product Features

### Properties & Units

Properties are buildings or complexes. Each property has units. Units have optional `dailyRate`, `monthlyRate`, and `annualRate` (Decimal 12,2). A unit can be marked `isUnavailable` to block new leases on it. Units are the resource leases attach to — one active lease per unit at a time (overlap validation).

**API:**
- `GET/POST /api/properties` — List and create properties
- `GET/PATCH/DELETE /api/properties/[id]` — Get, update, delete property
- `GET/POST /api/properties/[id]/units` — List units and create unit for property
- `GET/PATCH/DELETE /api/properties/[id]/units/[unitId]` — Get, update, delete unit
- `POST /api/properties/bulk-import` — Bulk import properties and units from Excel/CSV

**Bulk Import:**
- Supports Excel/CSV upload with validation
- Creates properties and their units in a single transaction
- Validates subscription limits before import
- Returns detailed success/failure report per row

**UI:**
- `/properties` — List page with search and filters
- `/properties/[id]` — Property detail with units list
- `/properties/[id]/units/[unitId]` — Unit detail page

### Tenants

Tenants don't control their own status. It's driven entirely by lease lifecycle:

| Event | Tenant becomes |
|---|---|
| Created (no lease) | LEAD |
| Lease created (DRAFT) | BOOKED |
| Lease paid / activated | ACTIVE |
| Lease ended, no other active leases | EXPIRED |
| Only DRAFT lease deleted, no other leases | LEAD |

There is no API endpoint to set tenant status directly — it's always a side effect of lease operations. A tenant can't be deleted if they have active leases.

**Schema Fields:**
- Required: `fullName`, at least one of `email` or `phone`
- Optional: `preferEmail`, `preferWhatsapp`, `preferTelegram` (notification preferences)
- Auto-managed: `status` (LEAD, BOOKED, ACTIVE, EXPIRED)

**API:**
- `GET/POST /api/tenants` — List and create tenants
- `GET/PATCH/DELETE /api/tenants/[id]` — Get, update, delete tenant
- `POST /api/tenants/bulk-import` — Bulk import tenants from Excel/CSV

**UI:**
- `/tenants` — List page with status filters and search
- `/tenants/[id]` — Tenant detail with leases and activity timeline

### Leases

Leases are the core entity. Everything flows from them.

**Status flow:** DRAFT → ACTIVE → ENDED or CANCELLED

- A new lease is always created as DRAFT.
- **Activation**: setting `paidAt` on a DRAFT auto-transitions it to ACTIVE and the tenant to ACTIVE.
- **Ending**: ACTIVE → ENDED transitions the tenant to EXPIRED (if no other active leases remain).
- **Cancellation**: only happens via the grace period cron — never manually.
- **Deletion**: only DRAFT leases can be deleted.

**What can't change after leaving DRAFT:** `startDate`, `endDate`, `paymentCycle`, `rentAmount`, `depositAmount`. These are locked once a lease is ACTIVE.

**Payment model:** Each lease represents ONE payment period. The `paidAt` field tracks when that single payment was made. For recurring rentals:
- **DAILY lease**: 1 day = 1 payment = 1 lease. Tomorrow's rent = new lease.
- **MONTHLY lease**: 1 month = 1 payment = 1 lease. Next month's rent = new lease.
- **ANNUAL lease**: 1 year = 1 payment = 1 lease. Next year's rent = new lease.
- Auto-renewal automatically creates the next lease when the current one expires.
- There is NO recurring payment tracking within a single lease — next payment = next lease.

**Extended Payment Tracking:**
Beyond `paidAt`, leases now support additional payment fields:
- `paymentDate` — When payment was received (DateTime)
- `paymentMethod` — CASH, BANK_TRANSFER, VIRTUAL_ACCOUNT, QRIS, MANUAL
- `paymentStatus` — PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED
- `externalId` — Third-party payment gateway transaction ID
- `externalResponse` — JSON response from payment gateway
- `paymentNotes` — Internal notes about the payment

**Overlapping lease validation:** Before creating a lease, the API checks for existing ACTIVE/DRAFT leases on the same unit with overlapping date ranges. Auto-renew leases that start before or on the new lease's `endDate` are also blocked.

**API:**
- `GET/POST /api/leases` — List and create leases
- `GET/PATCH/DELETE /api/leases/[id]` — Get, update, delete lease
- `GET /api/leases/[id]/check-future-lease` — Check if future lease exists (blocks auto-renew enable)
- `GET /api/units/[id]/active-lease` — Get active lease for a unit
- `POST /api/leases/bulk-import` — Bulk import leases with dry-run support

**UI:**
- `/leases` — List page with status filters, search, and quick actions
- `/leases/[id]` — Lease detail with payment history and activity timeline

### Auto-Renewal

Leases can have `isAutoRenew = true` with an `autoRenewalNoticeDays` value. The cron job (`/api/cron/process-auto-renewals`, runs 1am UTC daily) finds ACTIVE auto-renew leases where the notice deadline has passed (`now >= endDate - autoRenewalNoticeDays`) and that haven't already been renewed (`renewedTo = null`).

For each, it creates a new DRAFT lease as a renewal:
- New `startDate` = old `endDate` + 1 day
- New `endDate` calculated from `paymentCycle` (DAILY: +1 day, MONTHLY: +1 month - 1 day, ANNUAL: +1 year - 1 day)
- Same terms carried forward, linked via `renewedFromId`
- Original lease set to ENDED

**Disabling auto-renew is blocked once the notice deadline has passed** — the API checks `now >= endDate - autoRenewalNoticeDays` and rejects the change. Enabling auto-renew is blocked if another lease already exists on the unit after the current lease's `endDate` (checked via `/api/leases/[id]/check-future-lease`).

### Grace Period

DRAFT leases can have a `gracePeriodDays`. The cron job (`/api/cron/cancel-unpaid-leases`, runs midnight UTC daily) finds all DRAFT leases with a grace period and cancels those where `now > startDate + gracePeriodDays`. Status → CANCELLED with a LEASE_TERMINATED activity logged.

**Validation Helpers:**
- `calculateGracePeriodDeadline(startDate, gracePeriodDays)` — Returns the exact deadline DateTime
- `isLeaseOverdue(startDate, gracePeriodDays)` — Returns boolean if past deadline

### Deposits

Deposit status: HELD → RETURNED or FORFEITED. One-way, irreversible. Can only change on ENDED leases that haven't been renewed and are still HELD.

**Schema:**
- `depositAmount` (Decimal) — Amount held
- `depositStatus` (enum) — HELD, RETURNED, FORFEITED
- Deposit status transitions are validated in API — prevents reversal

### Subscription Tiers

| Tier | maxUsers | maxProperties | maxUnits | maxTenants |
|---|---|---|---|---|
| FREE | 1 | 1 | 10 | 10 |
| NORMAL | 5 | 3 | 100 | 100 |
| PRO | unlimited | unlimited | unlimited | unlimited |

Limits enforced server-side at creation time (POST handlers for tenants, properties, units, users). Returns 403 when exceeded. Signup creates a FREE subscription with ACTIVE status. Login is blocked if subscription is EXPIRED or CANCELLED.

**Enforcement:**
- `checkSubscriptionLimit(session, 'users' | 'properties' | 'units' | 'tenants')` helper
- Checked before all creation operations (properties, units, tenants, users)
- Bulk imports also validate against limits before processing

### Dashboard

Server component running 11 parallel Prisma queries. Shows:
- Property count, unit count (total), unavailable unit count
- Active tenant count, total tenant count
- Active lease count, draft lease count
- Monthly revenue: collected vs expected (filterable by month/year)
- Occupancy rate (active leases / total units)
- Expiring soon: top 10 active leases ending within 30 days with no renewal
- Earliest to expire: top 10 upcoming payments

Revenue calculation: "expected" = sum of `rentAmount` for ACTIVE leases overlapping the month; "collected" = sum of `rentAmount` for leases with `paidAt` in that month.

**API:**
- `GET /api/dashboard/overview?month=2&year=2026` — Returns all dashboard metrics

**UI:**
- `/dashboard` — Dashboard overview (server component)

### Organization Settings

Organizations can configure display preferences:

**Format Settings:**
- `dateFormat` — Date display format (dd/MM/yyyy, MM/dd/yyyy, yyyy-MM-dd). Default: dd/MM/yyyy
- `currency` — ISO currency code. Default: USD
- `currencySymbol` — Currency symbol for display. Default: $

**API:**
- `GET/PATCH /api/organization/formats` — Get and update organization format settings

**UI:**
- `/organization` — Organization settings page (includes formats, API keys, roles)

### API Keys

**Organization-specific API key management** for email, WhatsApp, and Telegram integrations.

**Schema:**
- `ApiKey` — Encrypted storage of organization API keys with service type
- Encrypted at rest using AES-256-GCM (encryption utility in `src/lib/encryption.ts`)
- Master key from `ENCRYPTION_SECRET` environment variable (32+ chars required)
- Additional fields: `lastUsedAt` (tracking), `isActive` (soft disable)

**Security:**
- API keys encrypted with AES-256-GCM, stored with IV and auth tag
- Full key shown only once at creation (copy-to-clipboard)
- Masked display in UI (e.g., `re_••••••••5a3f`)
- Decrypted only when sending notifications
- Activity logging for all key operations (create/update/delete)
- Deletion requires current password confirmation

**Services:**
- `RESEND_EMAIL` — Resend API key for email delivery
- `WHATSAPP_META` — WhatsApp Meta Cloud API credentials (JSON with accessToken, phoneNumberId, businessAccountId)
- `TELEGRAM_BOT` — Telegram bot token from @BotFather

**API:**
- `GET/POST /api/organization/api-keys` — List and create API keys
- `GET/PATCH/DELETE /api/organization/api-keys/[id]` — Get, update, delete API key
- `POST /api/organization/api-keys/[id]/test` — Test API key credentials (validates connection)

**UI:**
- `/organization` (API Keys tab) — Management interface with create/test/delete operations

**Migration:** Global `RESEND_API_KEY` environment variable deprecated. Each organization must configure their own API keys. Notifications fail with clear error if keys not configured.

### Notifications

**Fully implemented** notification system with email (Resend), WhatsApp (Meta Cloud API), and Telegram (Bot API) delivery.

**Schema:**
- `NotificationTemplate` — Email/WhatsApp/Telegram message templates with dynamic variables
- `NotificationRule` — Automated trigger rules with daysOffset, recipient config (TENANT/USER/ROLE)
- `NotificationLog` — Delivery tracking (PENDING → SENT/FAILED)

**Channels:**
- `EMAIL` — Via Resend API (requires org RESEND_EMAIL API key)
- `WHATSAPP` — Via Meta Cloud API (requires org WHATSAPP_META credentials)
- `TELEGRAM` — Via Telegram Bot API (requires org TELEGRAM_BOT token). **Uses phone numbers as identifiers** (not chat IDs).

**Template Variables:**
- `{{tenantName}}` — Tenant full name
- `{{leaseStartDate}}` — Lease start date (formatted per org settings)
- `{{leaseEndDate}}` — Lease end date (formatted per org settings)
- `{{rentAmount}}` — Lease rent amount (formatted per org currency)
- `{{propertyName}}` — Property name
- `{{unitName}}` — Unit name

**Triggers:**
- `PAYMENT_REMINDER` — Sent X days before payment due
- `PAYMENT_LATE` — Sent when payment is overdue
- `PAYMENT_CONFIRMED` — Sent when lease is paid (paidAt set)
- `LEASE_EXPIRING` — Sent X days before lease ends
- `LEASE_EXPIRED` — Sent when lease ends
- `MANUAL` — Manually triggered

**Tenant Preferences:** Respects `preferEmail`, `preferWhatsapp`, and `preferTelegram` flags on Tenant model. All phone-based channels (WhatsApp, Telegram) use the tenant's `phone` field.

**WhatsApp Integration:** Meta Cloud API direct (no BSP fees). Supports template messages (marketing/utility) and plain text (service messages). Credentials stored as encrypted JSON in ApiKey table.

**Telegram Integration:** Direct Telegram Bot API (no third-party library). Instant setup via @BotFather (< 1 minute). 100% free (up to 30 msg/sec). **Uses phone numbers for sending** (not chat IDs). Supports HTML formatting in messages.

**API Key Requirement:** All notifications require organization-specific API keys. If not configured, notifications fail with status FAILED and clear error message in NotificationLog.

**API:**
- `GET/POST /api/notifications/templates` — List and create templates
- `GET/PATCH/DELETE /api/notifications/templates/[id]` — Get, update, delete template
- `GET/POST /api/notifications/rules` — List and create rules
- `GET/PATCH/DELETE /api/notifications/rules/[id]` — Get, update, delete rule
- `GET /api/notifications/logs` — List notification logs (paginated)
- `GET /api/notifications/logs/[id]` — Get notification log details

**Cron Jobs:**
- `/api/cron/process-notifications` (2am UTC) — Processes PAYMENT_REMINDER, PAYMENT_LATE, and LEASE_EXPIRING notifications based on rules
- `/api/cron/end-expired-leases` (3am UTC) — Ends ACTIVE leases where endDate has passed, triggers LEASE_EXPIRED notifications

**Payment notification logic:**
- `PAYMENT_REMINDER`: Calculates due dates based on paymentCycle. For MONTHLY leases, reminds on the same day each month (e.g., if lease starts on 15th, reminds on 15th of each month). For DAILY leases, reminds daily. For ANNUAL leases, reminds on anniversary date.
- `PAYMENT_LATE`: Checks DRAFT leases with grace periods. If `now > startDate + gracePeriodDays`, triggers late notification.
- Note: Each lease = one payment. Recurring payments = recurring leases (via auto-renewal).

**UI:**
- `/notifications/templates` — Template management page
- `/notifications/rules` — Rule management page
- `/notifications/logs` — Notification log viewer with filters

### Maintenance Requests

**Fully implemented** maintenance request tracking system for property and unit maintenance issues.

**Schema:**
- `MaintenanceRequest` — Work orders with status, priority, cost tracking
- Status flow: OPEN → IN_PROGRESS → COMPLETED (or CANCELLED)
- Priority levels: LOW, MEDIUM, HIGH, URGENT

**Fields:**
- Required: `propertyId`, `title`, `description`
- Optional: `unitId`, `tenantId`, `leaseId` (flexible linking to any entity)
- Cost tracking: `estimatedCost`, `actualCost` (Decimal)
- Completion tracking: `completedAt` (auto-set when status → COMPLETED)

**Business Rules:**
- Only OPEN or CANCELLED requests can be deleted (not IN_PROGRESS or COMPLETED)
- Prevents accidental deletion of historical records
- Activity logging for all operations

**API:**
- `GET/POST /api/maintenance-requests` — List and create maintenance requests
- `GET/PATCH/DELETE /api/maintenance-requests/[id]` — Get, update, delete maintenance request
- `POST /api/maintenance-requests/bulk-import` — Bulk import maintenance requests from Excel/CSV

**UI:**
- `/maintenance-requests` — List page with filters (status, priority, property, search)
- `/maintenance-requests/[id]` — Detail page with full info and activity timeline

### Document Management

**Fully implemented** document storage and management using Vercel Blob.

**Schema:**
- `Document` — File metadata with optional foreign keys to any entity
- Stores: `filename`, `fileType`, `fileSize`, `fileUrl`, `storageKey`
- Optional links: `propertyId`, `unitId`, `tenantId`, `leaseId`

**File Storage:**
- Vercel Blob for cloud storage (public access URLs)
- Max file size: 10MB
- Allowed types: PDF, images (JPEG, PNG, GIF, WebP)
- Files stored with random suffix to avoid collisions

**Upload Flow:**
1. Client uploads file via FormData
2. Server validates file type/size and entity ownership
3. Upload to Vercel Blob
4. Save metadata to database
5. Log activity (DOCUMENT_UPLOADED)

**Deletion Flow:**
1. Verify document ownership
2. Log activity (DOCUMENT_DELETED)
3. Delete from Vercel Blob
4. Delete from database

**API:**
- `POST /api/documents/upload` — Upload document (multipart/form-data)
- `GET /api/documents` — List documents with filters (entityType, entityId, search)
- `GET/DELETE /api/documents/[id]` — Get or delete document

**UI:**
- `/documents` — List page with filters (entity type, search) and upload dialog
- Direct download/preview via `fileUrl` from Vercel Blob

**Environment:** Requires `BLOB_READ_WRITE_TOKEN` from Vercel dashboard.

### Analytics & Calendar

**Analytics:**
- Dashboard-style metrics with charts
- Revenue trends, occupancy trends, tenant acquisition
- Uses recharts for visualization

**Calendar:**
- Visual calendar view of lease schedules
- Uses react-big-calendar
- Shows lease start/end dates, overlaps, renewals

**UI:**
- `/analytics` — Analytics dashboard
- `/calendar` — Calendar view

### RBAC (Role-Based Access Control)

**Fully implemented** throughout API and UI. Roles, accesses, and user-role associations are modeled in the schema. The Owner role is system-protected (`isSystem: true`) and cannot be edited or deleted.

**Permission model:**

| Resource | Actions |
|---|---|
| properties | read, create, update, delete |
| units | read, create, update, delete |
| tenants | read, create, update, delete |
| leases | read, create, update, delete |
| notifications | read, create, update, delete |
| maintenance | read, create, update, delete |
| documents | read, create, delete |
| settings | manage (roles/accesses/api-keys) |
| users | manage |
| roles | read, create, update, delete |
| reports | read |

**API enforcement:** All route handlers use `requireAccess(resource, action)` from `src/lib/api` (auth-middleware.ts). It returns `{ authorized, response, session }` — handlers check `!authorized` and return the response (401/403 with error message). Session data is returned for convenience.

**UI enforcement:** All pages use `checkPageAccess(resource, action)` from `src/lib/guards.tsx` in a server component wrapper. If unauthorized, renders `<AccessDenied />` component; otherwise renders the client component (e.g. `<PropertiesClient />`).

**Navigation filtering:** `nav-links.tsx` uses `hasAccess()` helper to conditionally show links based on user permissions. Settings link only appears if user has `settings/manage` or `users/manage`.

**Protected operations:**
- Owner role: cannot be edited or deleted (enforced in API and UI)
- User mutations (invite/edit/delete): require `currentPassword` field for confirmation
- Signup: automatically creates Owner role with `isSystem: true` for new organizations

**API:**
- `GET/POST /api/accesses` — List and create accesses (for building permission system)

### Users & Authentication

**User Management:**
- Users belong to an organization
- Users have roles (many-to-many via UserRole)
- Password change requires current password verification
- Cannot delete last user in organization
- Cannot delete/demote last owner in organization

**API:**
- `GET /api/users` — List users in organization
- `POST /api/users/change-password` — Change user password (requires current password)

**Auth:**
- NextAuth 5 (beta) with Credentials provider
- JWT session strategy
- Password requirements: min 8 chars, lowercase, uppercase, digit, special char (`@$!%*?&`)

## Technical Conventions

### Stack

- **Next.js 16.1.6** (App Router)
- **React 19.2.3**
- **Tailwind 4**
- **Prisma 7** with `@prisma/adapter-pg` (PostgreSQL)
- **Zod 4** for validation
- **bcryptjs** for password hashing
- **date-fns 4.1.0** for date utilities
- **Vercel Blob** for document storage
- **Resend 6.9.2** for email
- **react-big-calendar 1.19.4** for calendar
- **recharts 3.7.0** for analytics charts
- **NextAuth 5** (beta.30) for authentication

Generated Prisma client output goes to `generated/prisma/`.

### Project Structure

```
src/app/(auth)/           — login, signup pages
src/app/(dashboard)/      — all authenticated pages (dashboard, properties, tenants, leases, etc.)
src/app/api/              — route handlers (auth, signup, CRUD, crons)
src/components/ui/        — shadcn/ui components
src/lib/                  — utilities, auth, guards, API helpers
src/lib/api/              — API utilities (auth, validation, error handling, etc.)
src/lib/services/         — notification services (email, WhatsApp, Telegram)
src/middleware.ts         — NextAuth route protection
prisma/schema.prisma      — database schema
prisma/seed.ts            — seed data
generated/prisma/         — generated Prisma client + types
```

### Library Utilities (`src/lib/`)

**Core:**
- `auth.ts` / `auth.config.ts` — NextAuth 5 configuration with Credentials provider
- `guards.tsx` — RBAC enforcement: `checkPageAccess()` (UI), `hasAccess()` (navigation), `<AccessDenied />` component
- `access-utils.ts` — Permission checking: `hasAccess(roles, resource, action)`
- `logger.ts` — Structured logging: `logger.info()`, `logger.error()`, `logger.apiError()`, `logger.cronError()`, `logger.cronInfo()` (server-side only)
- `prisma.ts` — Singleton Prisma client instance
- `utils.ts` — `cn()` for Tailwind class merging
- `constants.ts` — App-wide constants (subscription limits, permissions)
- `password.ts` — bcryptjs hashing/verification
- `encryption.ts` — AES-256-GCM encryption for API keys
- `zod-resolver.ts` — Zod integration for form validation
- `format.ts` — Formatting utilities (dates, currency)
- `bulk-validation.ts` — Bulk import validation helpers
- `excel-utils.ts` — Excel file parsing: `parseBooleanField()`, `parseDateFromExcel()`

**Date Utilities (`date-utils.ts`):**
Comprehensive date helpers for lease calculations:
- **Formatting:** `formatDate()`, `formatDateTime()`, `formatDateRange()`, `formatRelativeDate()`
- **Calculations:** `addDaysToDate()`, `addMonthsToDate()`, `addYearsToDate()`, `daysBetween()`, `monthsBetween()`, `yearsBetween()`
- **Comparisons:** `isPast()`, `isFuture()`, `isToday()`, `isDateInRange()`
- **Lease-specific:**
  - `calculateLeaseEndDate(startDate, paymentCycle)` — Calculate end date based on payment cycle
  - `isWithinGracePeriod(startDate, gracePeriodDays)` — Check if within grace period
  - `daysRemaining(endDate)` — Days until end date
  - `isLeaseExpiringSoon(endDate, thresholdDays)` — Check if expiring soon
  - `isLeaseExpired(endDate)` — Check if past end date
  - `getLeaseStatus(startDate, endDate, paidAt)` — Derive lease status
  - `calculateAutoRenewalNoticeDate(endDate, noticeDays)` — Calculate notice deadline
  - `shouldSendAutoRenewalNotice(endDate, noticeDays)` — Check if notice should be sent

**Notification services (`src/lib/services/`):**
- `notification-processor.ts` — Main notification processor: `processNotifications()`
- `notification-service.ts` — Channel handlers:
  - `sendEmail()` — Resend API integration
  - `sendWhatsApp()` — Meta Cloud API integration
  - `sendTelegram()` — Telegram Bot API integration
  - `sendNotification()` — Multi-channel dispatcher
- `whatsapp-meta-service.ts` — WhatsApp Meta Cloud API client
- `telegram-service.ts` — Telegram Bot API client

**API helpers (`src/lib/api/`):**
All re-exported via `index.ts` for convenience:

- `auth-middleware.ts` — Auth checking:
  - `requireAuth()` — Requires authenticated session
  - `requireAccess(resource, action)` — RBAC enforcement, returns `{ authorized, response, session }`
  - `verifyCronAuth()` — Verify cron secret bearer token

- `response.ts` — Standardized responses:
  - `apiSuccess(data)` — 200 OK
  - `apiCreated(data)` — 201 Created
  - `apiError(message, code)` — Custom error code
  - `apiUnauthorized()` — 401 Unauthorized
  - `apiForbidden()` — 403 Forbidden
  - `apiNotFound()` — 404 Not Found
  - `apiServerError(message)` — 500 Internal Server Error

- `error-handler.ts` — Centralized error handling:
  - `handleApiError(error, context)` — Auto-handles Zod/Prisma errors, logs with context
  - Handles: Zod validation errors (→ 400), Prisma P2002 (unique), P2025 (not found), P2003 (foreign key)

- `validation.ts` — Request validation:
  - `validateRequest(request, schema)` — Validate request body against Zod schema
  - `validateSearchParams(params, schema)` — Validate URL search params
  - `sanitizeSearchInput(input)` — Sanitize search strings
  - `parseEnumParam(value, enumValues)` — Parse enum from string

- `password-verification.ts` — Password confirmation:
  - `verifyCurrentUserPassword(userId, password)` — Verify user's current password
  - `extractPasswordFromRequest(request)` — Extract currentPassword from request body

- `subscription-limits.ts` — Tier limit enforcement:
  - `checkSubscriptionLimit(session, limitType)` — Check if can create more (users/properties/units/tenants)
  - Returns `{ allowed: boolean, message?: string }`

- `query-helpers.ts` — Common Prisma patterns:
  - `scopeToOrganization(organizationId)` — Returns `{ where: { organizationId } }`
  - `findUserInOrganization(userId, organizationId)` — Find user, ensure belongs to org
  - `findTenantInOrganization(tenantId, organizationId)` — Find tenant with validation
  - SELECT/INCLUDE constants for consistent queries

- `lease-validation.ts` — Lease validation:
  - `validateLeaseAvailability(unitId, startDate, endDate, excludeLeaseId?, organizationId)` — Check for overlapping leases
  - `canDeleteLease(lease)` — Check if lease can be deleted (only DRAFT)
  - `calculateGracePeriodDeadline(startDate, gracePeriodDays)` — Calculate deadline DateTime
  - `isLeaseOverdue(startDate, gracePeriodDays)` — Check if past grace period

- `user-validation.ts` — User validation:
  - `ensureNotLastOwner(userId, organizationId)` — Prevent removing last owner
  - `ensureNotLastUser(userId, organizationId)` — Prevent deleting last user
  - `validateRoleChange(userId, newRoleIds, organizationId)` — Validate role updates

- `activity-logger.ts` — Activity logging:
  - `logActivity(organizationId, type, metadata)` — Log activity with metadata
  - `ActivityLogger` class with convenience methods for all activity types

- `pagination.ts` — Pagination helpers:
  - `parsePaginationParams(searchParams)` — Parse `page` and `limit` from URL params
  - `createPaginatedResponse(items, total, page, limit)` — Create paginated response
  - DEFAULT_LIMIT = 50, MAX_LIMIT = 100

- `index.ts` — Re-exports all API utilities + logger for easy importing

### Auth & Middleware

NextAuth 5 (beta) with Credentials provider only. JWT session strategy — session carries `id`, `organizationId`, subscription (with tier), and roles (with `roleAccesses` including resource/action pairs).

Middleware protects all routes except: `/login`, `/signup`, `/api/signup`, `/api/auth/**`, `/api/cron/**`. Unauthenticated requests redirect to `/login?callbackUrl=...`. Dashboard layout has a secondary server-side `auth()` check.

Password requirements: min 8 chars, lowercase, uppercase, digit, special char (`@$!%*?&`).

### API Patterns

Route handlers in `src/app/api/`. Every handler follows this pattern:

1. **Import utilities from `@/lib/api`:**
```typescript
import { requireAccess, handleApiError, validateRequest, apiSuccess } from "@/lib/api";
```

2. **RBAC enforcement:**
```typescript
const { authorized, response, session } = await requireAccess('properties', 'create');
if (!authorized) return response;
const organizationId = session.user.organizationId;
```

3. **Validate input** (optional helpers):
```typescript
const validatedData = await validateRequest(request, createPropertySchema);
// OR inline:
const body = await request.json();
const validatedData = createPropertySchema.parse(body);
```

4. **Scope all queries by `organizationId`:**
```typescript
const properties = await prisma.property.findMany({
  where: { organizationId },
  // ...
});
```

5. **Use centralized error handling:**
```typescript
try {
  // ... handler logic
  return apiSuccess(data);
} catch (error) {
  return handleApiError(error, "create property");
}
```

**Error handling benefits:**
- `handleApiError()` automatically handles Zod validation errors (→ 400)
- Auto-handles Prisma errors: P2002 (unique constraint), P2025 (not found), P2003 (foreign key)
- Logs errors via `logger.apiError()` with full context
- Returns consistent error responses with appropriate status codes

**Logging:**
- Use `logger` from `@/lib/api` for all server-side logging
- `logger.apiError(endpoint, error, { organizationId })` for API route errors (used automatically by `handleApiError`)
- `logger.cronError(jobName, error, context)` for cron job errors
- `logger.info(message, context)` for informational logs
- Never use `console.log/error/warn` in production code

**Response helpers:**
```typescript
return apiSuccess(data);           // 200 OK
return apiCreated(data);           // 201 Created
return apiError("Message", 400);   // 400 Bad Request
return apiUnauthorized();          // 401 Unauthorized
return apiForbidden();             // 403 Forbidden
return apiNotFound();              // 404 Not Found
return apiServerError("Message");  // 500 Internal Server Error
```

Business rules are always enforced server-side — never trust the client.

**Pagination:**
- Use `parsePaginationParams(request.nextUrl.searchParams)` to get `{ page, limit }`
- DEFAULT_LIMIT = 50, MAX_LIMIT = 100
- Use `createPaginatedResponse(items, total, page, limit)` to create response
- Returns `{ items: T[], pagination: { page, limit, total, totalPages } }`

### Logging & Error Tracking

**Centralized logger** (`src/lib/logger.ts`) — server-side only, do NOT import in client components.

**Logger methods:**
- `logger.info(message, context?)` — Informational events
- `logger.warn(message, context?)` — Warnings (non-errors)
- `logger.error(message, error?, context?)` — Generic errors
- `logger.debug(message, data?)` — Debug info (dev only)
- `logger.apiError(endpoint, error, context?)` — API route errors (used by `handleApiError`)
- `logger.cronError(jobName, error, context?)` — Cron job errors
- `logger.cronInfo(jobName, message, context?)` — Cron job info

**Context object** (optional):
```typescript
{
  userId?: string;
  organizationId?: string;
  resource?: string;
  action?: string;
  [key: string]: unknown;
}
```

**Sensitive data sanitization:**
The logger automatically redacts: `password`, `currentPassword`, `token`, `apiKey`, `secret`, `accessToken`, `refreshToken`

**Environment behavior:**
- **Development:** Full console logging with colors and stack traces
- **Production:** Structured JSON logs (ready for log aggregators like Datadog, CloudWatch, etc.)
- Future: Integration with Sentry/LogRocket for error tracking (TODOs in logger.ts)

**Best practices:**
- Always use `logger` instead of `console.log/error/warn`
- Use `handleApiError()` for catch blocks (it logs automatically)
- Provide context (organizationId, userId) when available
- For async operations that might fail after response is sent, capture variables in closure:
```typescript
const orgId = session.user.organizationId;
someAsyncOperation().catch((err) => {
  logger.apiError("async operation", err, { organizationId: orgId });
});
```

### Cron Jobs

Defined in `vercel.json`. All are POST endpoints protected by `CRON_SECRET` bearer token via `verifyCronAuth()`.

| Cron | Schedule | What it does |
|---|---|---|
| `/api/cron/cancel-unpaid-leases` | `0 0 * * *` (midnight UTC) | Cancels DRAFT leases past grace deadline (`now > startDate + gracePeriodDays`) |
| `/api/cron/process-auto-renewals` | `0 1 * * *` (1am UTC) | Creates renewal DRAFT leases for auto-renew leases past notice deadline |
| `/api/cron/process-notifications` | `0 2 * * *` (2am UTC) | Processes PAYMENT_REMINDER, PAYMENT_LATE, LEASE_EXPIRING notifications |
| `/api/cron/end-expired-leases` | `0 3 * * *` (3am UTC) | Ends ACTIVE leases where `endDate` has passed, triggers LEASE_EXPIRED notifications |

**Auth:**
- All crons use `verifyCronAuth()` to verify `CRON_SECRET` bearer token
- Returns 401 if secret missing or invalid

**Response Format:**
All crons return structured JSON with operation counts:
```typescript
{
  success: true,
  processed: number,
  details: Array<{ id: string, status: string, ... }>
}
```

### UI Patterns

- **Components:** shadcn/ui components in `src/components/ui/`
- **Icons:** `@hugeicons/react` + `@hugeicons/core-free-icons`
- **Class merging:** `cn()` utility from `clsx` + `tailwind-merge`

**Page structure:**
Server component wrapper that calls `checkPageAccess(resource, action)` → renders client component (e.g. `<PropertiesClient />`) if authorized, otherwise `<AccessDenied />`.

Example:
```typescript
// src/app/(dashboard)/properties/page.tsx
import { checkPageAccess } from "@/lib/guards";
import PropertiesClient from "./PropertiesClient";

export default async function PropertiesPage() {
  const accessCheck = await checkPageAccess("properties", "read");
  if (!accessCheck.authorized) {
    return accessCheck.component; // <AccessDenied />
  }
  return <PropertiesClient />;
}
```

**UI Conventions:**
- List pages and detail pages are client components (`"use client"`) that fetch on mount
- Dashboard is a server component (fetches directly)
- Skeleton placeholders for loading states
- `Dialog` for create/edit modals
- `AlertDialog` for destructive confirmations
- Activity timeline on detail pages with color-coded icons:
  - Blue (lease icon) — lease events
  - Violet (tenant icon) — tenant events
  - Emerald (property icon) — property/unit events
  - Amber (payment icon) — payment events

**Navigation:**
- Top-bar navigation with active state via `usePathname`
- Tier badge showing subscription level
- User dropdown with logout
- Links filtered by `hasAccess()` helper
- Settings link only visible if user has `settings/manage` or `users/manage`

### Seed Data

`prisma/seed.ts` — run via `tsx prisma/seed.ts`. Uses a `daysFromNow()` helper for all dates so lease states remain valid relative to when the seed runs (important for cron testing).

Creates:
- Test org with PRO subscription (ACTIVE status)
- Owner role with `isSystem: true`
- Test user: `test@test.com` / `Password1!`
- 2 properties with 7 units total
- 3 tenants with various statuses
- 9 leases covering all states:
  - DRAFT (unpaid)
  - ACTIVE (with/without auto-renewal)
  - ACTIVE with notice period passed (ready for renewal)
  - ENDED (with deposit RETURNED and FORFEITED)
  - Renewal chains (linked via `renewedFromId`/`renewedTo`)
  - Future lease blocking auto-renewal

**Important:** All dates are relative to seed run time, so test data remains valid for cron testing.

### Environment Variables

Required environment variables:

**Database:**
- Database connection string (via Prisma/DATABASE_URL)

**Auth:**
- `NEXTAUTH_SECRET` — NextAuth JWT signing secret
- `NEXTAUTH_URL` — App URL for NextAuth

**Encryption:**
- `ENCRYPTION_SECRET` — 32+ character secret for AES-256-GCM encryption of API keys

**Cron Jobs:**
- `CRON_SECRET` — Bearer token for cron job authentication

**File Storage:**
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob access token

**Organization API Keys** (configured per-org in UI, not env vars):
- RESEND_EMAIL — Resend API key
- WHATSAPP_META — WhatsApp credentials JSON
- TELEGRAM_BOT — Telegram bot token

### Bulk Import

All major entities support bulk import via Excel/CSV:

**Endpoints:**
- `POST /api/properties/bulk-import` — Properties with units
- `POST /api/tenants/bulk-import` — Tenants
- `POST /api/leases/bulk-import` — Leases (supports `dryRun` param)
- `POST /api/maintenance-requests/bulk-import` — Maintenance requests

**Process:**
1. Upload Excel/CSV file via FormData
2. Parse rows using `excel-utils.ts` helpers
3. Validate each row against Zod schema
4. Check subscription limits
5. Insert valid rows, return detailed report

**Response:**
```typescript
{
  success: boolean,
  imported: number,
  failed: number,
  errors: Array<{ row: number, message: string }>
}
```

**Dry Run:**
Lease bulk import supports `?dryRun=true` query param to validate without inserting.

## API Endpoint Reference

### Properties
- `GET/POST /api/properties`
- `GET/PATCH/DELETE /api/properties/[id]`
- `GET/POST /api/properties/[id]/units`
- `GET/PATCH/DELETE /api/properties/[id]/units/[unitId]`
- `POST /api/properties/bulk-import`

### Tenants
- `GET/POST /api/tenants`
- `GET/PATCH/DELETE /api/tenants/[id]`
- `POST /api/tenants/bulk-import`

### Leases
- `GET/POST /api/leases`
- `GET/PATCH/DELETE /api/leases/[id]`
- `GET /api/leases/[id]/check-future-lease`
- `GET /api/units/[id]/active-lease`
- `POST /api/leases/bulk-import`

### Maintenance
- `GET/POST /api/maintenance-requests`
- `GET/PATCH/DELETE /api/maintenance-requests/[id]`
- `POST /api/maintenance-requests/bulk-import`

### Documents
- `POST /api/documents/upload`
- `GET /api/documents`
- `GET/DELETE /api/documents/[id]`

### Notifications
- `GET/POST /api/notifications/templates`
- `GET/PATCH/DELETE /api/notifications/templates/[id]`
- `GET/POST /api/notifications/rules`
- `GET/PATCH/DELETE /api/notifications/rules/[id]`
- `GET /api/notifications/logs`
- `GET /api/notifications/logs/[id]`

### Organization
- `GET/PATCH /api/organization/formats`
- `GET/POST /api/organization/api-keys`
- `GET/PATCH/DELETE /api/organization/api-keys/[id]`
- `POST /api/organization/api-keys/[id]/test`

### Users & Auth
- `GET /api/users`
- `POST /api/users/change-password`
- `POST /api/signup`

### RBAC
- `GET/POST /api/accesses`

### Dashboard
- `GET /api/dashboard/overview?month=2&year=2026`

### Cron Jobs
- `POST /api/cron/cancel-unpaid-leases`
- `POST /api/cron/process-auto-renewals`
- `POST /api/cron/process-notifications`
- `POST /api/cron/end-expired-leases`

## Page Routes

### Auth
- `/login` — Login page
- `/signup` — Signup page (creates FREE subscription)

### Dashboard
- `/dashboard` — Overview dashboard

### Properties & Units
- `/properties` — Properties list
- `/properties/[id]` — Property detail
- `/properties/[id]/units/[unitId]` — Unit detail

### Tenants
- `/tenants` — Tenants list
- `/tenants/[id]` — Tenant detail

### Leases
- `/leases` — Leases list
- `/leases/[id]` — Lease detail

### Maintenance
- `/maintenance-requests` — Maintenance requests list
- `/maintenance-requests/[id]` — Maintenance request detail

### Documents
- `/documents` — Documents list with upload

### Notifications
- `/notifications/templates` — Template management
- `/notifications/rules` — Rule management
- `/notifications/logs` — Notification logs

### Organization
- `/organization` — Organization settings (formats, API keys, roles)

### Analytics & Calendar
- `/analytics` — Analytics dashboard
- `/calendar` — Calendar view

## Database Schema Highlights

### Key Enums
- **TenantStatus:** LEAD, BOOKED, ACTIVE, EXPIRED
- **LeaseStatus:** DRAFT, ACTIVE, ENDED, CANCELLED
- **PaymentCycle:** DAILY, MONTHLY, ANNUAL
- **PaymentStatus:** PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED
- **PaymentMethod:** CASH, BANK_TRANSFER, VIRTUAL_ACCOUNT, QRIS, MANUAL
- **DepositStatus:** HELD, RETURNED, FORFEITED
- **MaintenanceRequestStatus:** OPEN, IN_PROGRESS, COMPLETED, CANCELLED
- **MaintenanceRequestPriority:** LOW, MEDIUM, HIGH, URGENT
- **NotificationChannel:** EMAIL, WHATSAPP, TELEGRAM
- **NotificationTrigger:** PAYMENT_REMINDER, PAYMENT_LATE, PAYMENT_CONFIRMED, LEASE_EXPIRING, LEASE_EXPIRED, MANUAL
- **NotificationStatus:** PENDING, SENT, FAILED
- **SubscriptionTierType:** FREE, NORMAL, PRO
- **ApiKeyService:** RESEND_EMAIL, WHATSAPP_META, TELEGRAM_BOT

### Core Models

**Organization:**
- Basic info: `name`, `createdAt`, `updatedAt`
- Format settings: `dateFormat`, `currency`, `currencySymbol`
- Relations: users, properties, units, tenants, leases, documents, etc.

**User:**
- Auth: `email`, `password` (hashed)
- Profile: `fullName`
- Relations: `organizationId`, `roles` (many-to-many via UserRole)

**Property:**
- Info: `name`, `address`, `organizationId`
- Relations: units, leases, documents, maintenance requests

**Unit:**
- Info: `name`, `propertyId`, `organizationId`
- Pricing: `dailyRate`, `monthlyRate`, `annualRate` (Decimal 12,2)
- Availability: `isUnavailable`
- Relations: leases, documents, maintenance requests

**Tenant:**
- Info: `fullName`, `email`, `phone`, `organizationId`
- Status: `status` (auto-managed by lease lifecycle)
- Preferences: `preferEmail`, `preferWhatsapp`, `preferTelegram`
- Relations: leases, documents, maintenance requests

**LeaseAgreement:**
- Core: `unitId`, `tenantId`, `organizationId`, `startDate`, `endDate`, `paymentCycle`, `status`
- Pricing: `rentAmount`, `depositAmount`, `depositStatus`
- Payment: `paidAt`, `paymentDate`, `paymentMethod`, `paymentStatus`, `externalId`, `externalResponse`, `paymentNotes`
- Auto-renewal: `isAutoRenew`, `autoRenewalNoticeDays`, `renewedFromId`, `renewedTo`
- Grace: `gracePeriodDays`
- Relations: property, unit, tenant, documents

**Document:**
- File: `filename`, `fileType`, `fileSize`, `fileUrl`, `storageKey`
- Links: `propertyId`, `unitId`, `tenantId`, `leaseId` (all optional)
- Relations: organization, property, unit, tenant, lease

**MaintenanceRequest:**
- Info: `title`, `description`, `status`, `priority`
- Links: `propertyId` (required), `unitId`, `tenantId`, `leaseId` (optional)
- Cost: `estimatedCost`, `actualCost`
- Completion: `completedAt`

**NotificationTemplate:**
- Info: `name`, `channel`, `subject` (email only), `body`
- System: `isSystem` (protected from deletion)

**NotificationRule:**
- Trigger: `trigger`, `daysOffset`
- Recipients: `recipientType`, `recipientRoleId`, `recipientUserId`
- Template: `templateId`, `channel`
- System: `isSystem` (protected from deletion)

**NotificationLog:**
- Tracking: `channel`, `status`, `recipient`, `subject`, `body`
- Error: `errorMessage`
- Links: `tenantId`, `leaseId` (optional)
- Sent: `sentAt`

**ApiKey:**
- Info: `name`, `service`, `encryptedKey`, `iv`, `authTag`
- Tracking: `lastUsedAt`, `isActive`
- Security: AES-256-GCM encryption

**Activity:**
- Info: `type`, `metadata` (JSON)
- Relations: organization, user

**Role:**
- Info: `name`, `description`, `organizationId`
- System: `isSystem` (Owner role protected)
- Relations: accesses (many-to-many via RoleAccess), users (many-to-many via UserRole)

**Access:**
- Info: `resource`, `action`, `organizationId`

**Subscription:**
- Info: `tier`, `status`, `organizationId`
- Billing: `currentPeriodStart`, `currentPeriodEnd`, `billingCycle`
- Relations: organization, invoices

**SubscriptionTier:**
- Limits: `maxUsers`, `maxProperties`, `maxUnits`, `maxTenants`
- Pricing: `monthlyPrice`, `annualPrice`
- Features: features (many-to-many via TierFeature)
