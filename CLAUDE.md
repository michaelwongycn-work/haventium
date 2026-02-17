# Haventium

Rental property management CRM. Multi-tenant SaaS where every piece of data is scoped to an organization — every Prisma query must include `organizationId` in its `where` clause.

## Development Rules

- **Never run Prisma migrations** (`prisma migrate dev`, `prisma db push`, etc.) — the developer handles all migrations manually.
- **Use pnpm** for package management (not npm or bun).

## Product

### Properties & Units

Properties are buildings or complexes. Each property has units. Units have optional `dailyRate`, `monthlyRate`, and `annualRate` (Decimal 12,2). A unit can be marked `isUnavailable` to block new leases on it. Units are the resource leases attach to — one active lease per unit at a time (overlap validation).

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

**Overlapping lease validation:** before creating a lease, the API checks for existing ACTIVE/DRAFT leases on the same unit with overlapping date ranges. Auto-renew leases that start before or on the new lease's `endDate` are also blocked.

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

### Deposits

Deposit status: HELD → RETURNED or FORFEITED. One-way, irreversible. Can only change on ENDED leases that haven't been renewed and are still HELD.

### Subscription Tiers

| Tier | maxUsers | maxProperties | maxUnits | maxTenants |
|---|---|---|---|---|
| FREE | 1 | 1 | 10 | 10 |
| NORMAL | 5 | 3 | 100 | 100 |
| PRO | unlimited | unlimited | unlimited | unlimited |

Limits enforced server-side at creation time (POST handlers for tenants, properties, units). Returns 403 when exceeded. Signup creates a FREE subscription with ACTIVE status. Login is blocked if subscription is EXPIRED or CANCELLED.

### Dashboard

Server component running 11 parallel Prisma queries. Shows:
- Property count, unit count (available/unavailable), tenant count (active/inactive), active lease count
- Monthly revenue: collected vs expected, filterable by month/year
- Draft lease count, occupancy rate (active leases / total units)
- Expiring soon: active leases ending within 30 days with no renewal
- Earliest to expire: all active leases sorted by end date

Revenue calculation: "expected" = sum of `rentAmount` for ACTIVE leases overlapping the month; "collected" = sum of `rentAmount` for leases with `paidAt` in that month.

### API Keys

**Organization-specific API key management** for email and WhatsApp integrations.

**Schema:**
- `ApiKey` — Encrypted storage of organization API keys with service type (RESEND_EMAIL, WHATSAPP_META)
- Encrypted at rest using AES-256-GCM (encryption utility in `src/lib/encryption.ts`)
- Master key from `ENCRYPTION_SECRET` environment variable (32+ chars required)

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

**API:** CRUD at `/api/settings/api-keys` and `/api/settings/api-keys/[id]`. Test endpoint at `/api/settings/api-keys/[id]/test` validates credentials. All protected by `requireAccess('settings', 'manage')`.

**UI:** Management interface at `/settings/api-keys` with create/test/delete operations.

**Migration:** Global `RESEND_API_KEY` environment variable deprecated. Each organization must configure their own API keys. Notifications fail with clear error if keys not configured.

### Notifications

**Fully implemented** notification system with email (Resend), WhatsApp (Meta Cloud API), and Telegram (Bot API) delivery.

**Schema:**
- `NotificationTemplate` — Email/WhatsApp/Telegram message templates with dynamic variables
- `NotificationRule` — Automated trigger rules (PAYMENT_REMINDER, LEASE_EXPIRING, etc.) with daysOffset, recipient config (TENANT/USER/ROLE)
- `NotificationLog` — Delivery tracking (PENDING → SENT/FAILED)

**Channels:**
- `EMAIL` — Via Resend API (requires org RESEND_EMAIL API key)
- `WHATSAPP` — Via Meta Cloud API (requires org WHATSAPP_META credentials)
- `TELEGRAM` — Via Telegram Bot API (requires org TELEGRAM_BOT token). Uses phone numbers as identifiers.

**Template Variables:**
- `{{tenantName}}` — Tenant full name
- `{{leaseStartDate}}` — Lease start date
- `{{leaseEndDate}}` — Lease end date
- `{{rentAmount}}` — Lease rent amount
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

**Telegram Integration:** Direct Telegram Bot API (no third-party library). Instant setup via @BotFather (< 1 minute). 100% free (up to 30 msg/sec). Uses phone numbers for sending. Supports HTML formatting in messages.

**API Key Requirement:** All notifications require organization-specific API keys. If not configured, notifications fail with status FAILED and clear error message in NotificationLog.

**API:** Full CRUD for templates and rules at `/api/notifications/templates` and `/api/notifications/rules`. Read-only logs at `/api/notifications/logs`. All endpoints protected by `requireAccess('notifications', action)`.

**Cron Jobs:**
- `/api/cron/process-notifications` (2am UTC) — Processes PAYMENT_REMINDER, PAYMENT_LATE, and LEASE_EXPIRING notifications based on rules
- `/api/cron/end-expired-leases` (3am UTC) — Ends ACTIVE leases where endDate has passed, triggers LEASE_EXPIRED notifications

**Payment notification logic:**
- `PAYMENT_REMINDER`: Calculates due dates based on paymentCycle. For MONTHLY leases, reminds on the same day each month (e.g., if lease starts on 15th, reminds on 15th of each month). For DAILY leases, reminds daily. For ANNUAL leases, reminds on anniversary date.
- `PAYMENT_LATE`: Checks DRAFT leases with grace periods. If `now > startDate + gracePeriodDays`, triggers late notification.
- Note: Each lease = one payment. Recurring payments = recurring leases (via auto-renewal).

**UI:** Management interfaces at `/notifications/templates`, `/notifications/rules`, `/notifications/logs`.

### Maintenance Requests

**Fully implemented** maintenance request tracking system for property and unit maintenance issues.

**Schema:**
- `MaintenanceRequest` — Work orders with status, priority, cost tracking
- Status flow: OPEN → IN_PROGRESS → COMPLETED (or CANCELLED)
- Priority levels: LOW, MEDIUM, HIGH, URGENT

**Fields:**
- Required: propertyId, title, description
- Optional: unitId, tenantId, leaseId (flexible linking to any entity)
- Cost tracking: estimatedCost, actualCost
- Completion tracking: completedAt (auto-set when status → COMPLETED)

**Business Rules:**
- Only OPEN or CANCELLED requests can be deleted (not IN_PROGRESS or COMPLETED)
- Prevents accidental deletion of historical records
- Activity logging for all operations

**API:** CRUD at `/api/maintenance-requests` and `/api/maintenance-requests/[id]`. All protected by `requireAccess('maintenance', action)`.

**UI:** List page at `/maintenance-requests` with filters (status, priority, property, search). Detail page at `/maintenance-requests/[id]` with full info and activity timeline.

### Document Management

**Fully implemented** document storage and management using Vercel Blob.

**Schema:**
- `Document` — File metadata with optional foreign keys to any entity
- Stores: filename, fileType, fileSize, fileUrl, storageKey
- Optional links: propertyId, unitId, tenantId, leaseId

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
5. Log activity

**Deletion Flow:**
1. Verify document ownership
2. Log activity
3. Delete from Vercel Blob
4. Delete from database

**API:** Upload at `/api/documents/upload` (POST with multipart/form-data), list at `/api/documents`, detail/delete at `/api/documents/[id]`. All protected by `requireAccess('documents', action)`.

**UI:** List page at `/documents` with filters (entity type, search) and upload dialog. Direct download/preview via fileUrl.

**Environment:** Requires `BLOB_READ_WRITE_TOKEN` from Vercel dashboard.

### RBAC

**Fully implemented** throughout API and UI. Roles, accesses, and user-role associations are modeled in the schema. The Owner role is system-protected (`isSystem: true`) and cannot be edited or deleted.

**Permission model:**

| Resource | Actions |
|---|---|
| properties | read, create, update, delete |
| tenants | read, create, update, delete |
| leases | read, create, update, delete |
| notifications | read, create, update, delete |
| maintenance | read, create, update, delete |
| documents | read, create, delete |
| settings | manage (roles/accesses/api-keys) |
| users | manage |

**API enforcement:** All route handlers use `requireAccess(resource, action)` from `src/lib/api` (auth-middleware.ts). It returns `{ authorized, response, session }` — handlers check `!authorized` and return the response (401/403 with error message). Session data is returned for convenience.

**UI enforcement:** All pages use `checkPageAccess(resource, action)` from `src/lib/guards.tsx` in a server component wrapper. If unauthorized, renders `<AccessDenied />` component; otherwise renders the client component (e.g. `<PropertiesClient />`).

**Navigation filtering:** `nav-links.tsx` uses `hasAccess()` helper to conditionally show links based on user permissions. Settings link only appears if user has `settings/manage` or `users/manage`.

**Protected operations:**
- Owner role: cannot be edited or deleted (enforced in API and UI)
- User mutations (invite/edit/delete): require `currentPassword` field for confirmation
- Signup: automatically creates Owner role with `isSystem: true` for new organizations

## Technical Conventions

### Stack

Next.js 16 (App Router), React 19, Tailwind 4, Prisma 7 with `@prisma/adapter-pg` (PostgreSQL). Generated Prisma client output goes to `generated/prisma/`. Zod 4 for validation. bcryptjs for password hashing.

### Project Structure

```
src/app/(auth)/           — login, signup pages
src/app/(dashboard)/      — all authenticated pages (dashboard, properties, tenants, leases)
src/app/api/              — route handlers (auth, signup, CRUD, crons)
src/components/ui/        — shadcn/ui components
src/lib/                  — utilities, auth, guards, API helpers
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
- `date-utils.ts` — Date manipulation helpers
- `encryption.ts` — AES-256-GCM encryption for API keys
- `zod-resolver.ts` — Zod integration for form validation

**Notification services (`src/lib/services/`):**
- `notification-processor.ts` — Main notification processor: `processNotifications()`
- `email-service.ts` — Resend email delivery
- `whatsapp-service.ts` — Meta Cloud API WhatsApp delivery
- `telegram-service.ts` — Telegram Bot API delivery

**API helpers (`src/lib/api/`):**
- `auth-middleware.ts` — Auth checking: `requireAuth()`, `requireAccess(resource, action)`, `verifyCronAuth()`
- `response.ts` — Standardized responses: `apiSuccess()`, `apiError()`, `apiCreated()`, `apiUnauthorized()`, `apiForbidden()`, `apiNotFound()`, `apiServerError()`
- `error-handler.ts` — Centralized error handling: `handleApiError(error, context)` (auto-handles Zod/Prisma errors, logs with context)
- `validation.ts` — Zod schema validation: `validateRequest()`, `validateSearchParams()`, `sanitizeSearchInput()`, `parseEnumParam()`
- `password-verification.ts` — Password confirmation: `verifyCurrentUserPassword()`, `extractPasswordFromRequest()`
- `subscription-limits.ts` — Tier limit enforcement: `checkSubscriptionLimit()`
- `query-helpers.ts` — Common Prisma patterns: `scopeToOrganization()`, `findUserInOrganization()`, `findTenantInOrganization()`, etc.
- `lease-validation.ts` — Lease validation: `validateLeaseAvailability()`, `canDeleteLease()`, `calculateGracePeriodDeadline()`, `isLeaseOverdue()`
- `user-validation.ts` — User validation: `ensureNotLastOwner()`, `ensureNotLastUser()`, `validateRoleChange()`
- `activity-logger.ts` — Activity logging: `logActivity()`
- `pagination.ts` — Pagination helpers: `parsePaginationParams()`, `createPaginatedResponse()`
- `index.ts` — Re-exports all API utilities + logger

### Auth & Middleware

NextAuth 5 (beta) with Credentials provider only. JWT session strategy — session carries `id`, `organizationId`, subscription (with tier), and roles (with accesses).

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

Defined in `vercel.json`. Both are POST endpoints protected by optional `CRON_SECRET` bearer token.

| Cron | Schedule | What it does |
|---|---|---|
| `/api/cron/cancel-unpaid-leases` | `0 0 * * *` (midnight UTC) | Cancels DRAFT leases past grace deadline |
| `/api/cron/process-auto-renewals` | `0 1 * * *` (1am UTC) | Creates renewal DRAFT leases for auto-renew leases past notice deadline |

### UI Patterns

- shadcn/ui components in `src/components/ui/`, icons from `@hugeicons/react` + `@hugeicons/core-free-icons`
- `cn()` utility from `clsx` + `tailwind-merge` for class merging
- **Page structure:** Server component wrapper that calls `checkPageAccess(resource, action)` → renders client component (e.g. `<PropertiesClient />`) if authorized, otherwise `<AccessDenied />`
- List pages and detail pages are client components (`"use client"`) that fetch on mount. Dashboard is a server component.
- Skeleton placeholders for loading states
- `Dialog` for create/edit modals, `AlertDialog` for destructive confirmations
- Activity timeline on detail pages with color-coded icons (blue=lease, violet=tenant, emerald=property, amber=payment)
- Top-bar navigation with active state via `usePathname`, tier badge, user dropdown, links filtered by `hasAccess()` helper

### Seed Data

`prisma/seed.ts` — run via `tsx prisma/seed.ts`. Uses a `daysFromNow()` helper for all dates so lease states remain valid relative to when the seed runs (important for cron testing). Creates:
- Test org, PRO subscription, Owner role, test user (`test@test.com` / `Password1!`)
- 2 properties with 7 units total
- 3 tenants
- 9 leases covering all states: DRAFT, ACTIVE (with/without auto-renewal), notice period passed, ENDED (with/without deposit), renewal chains, future lease blocking
