# Haventium — Rental Property Management CRM

Multi-tenant SaaS platform for managing rental properties, units, tenants, and leases with automated billing and notifications. Every piece of data is scoped to an organization.

## Core Development Rules

1. **Multi-tenant security:** Every Prisma query MUST include `organizationId` in its `where` clause. Zero exceptions.
2. **Never run Prisma migrations manually.** Developer handles all migrations. `prisma generate` IS allowed (required after schema changes).
3. **Use pnpm only** (not npm or bun).
4. **Package manager:** `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`

## Tech Stack

- **Framework:** Next.js 16 with App Router (TypeScript)
- **ORM:** Prisma 7 with PostgreSQL (client output: `generated/prisma/`)
- **Auth:** NextAuth 5 (beta) with Credentials provider, JWT sessions
- **UI:** React 19, shadcn/ui, Tailwind CSS 4
- **Icons:** @hugeicons/react
- **Forms:** React Hook Form + Zod validation
- **Payment:** Xendit (subscription billing + tenant rent collection)
- **Email:** MailerSend (transactional + verification emails)
- **File storage:** Vercel Blob
- **Notifications:** Email (MailerSend), WhatsApp (Meta Cloud API), Telegram (Bot API)

## Database & Prisma

- **Generated client location:** `generated/prisma/` (custom output in generator config)
- **Enums auto-generated:** `generated/prisma/enums.ts` — updated by `prisma generate`
- **JSON fields:** Must use `JSON.parse(JSON.stringify(value))` to satisfy TypeScript types (used in `externalResponse` fields on LeaseAgreement and PaymentTransaction)
- **Activity enum:** `ActivityType` must match Prisma schema exactly; defined in `src/lib/api/activity-logger.ts`

## API Architecture

### Standard Route Handler Pattern

All route handlers in `src/app/api/` follow this pattern:

```typescript
import { requireAccess, handleApiError, validateRequest, apiSuccess } from "@/lib/api";

export async function GET(request: Request) {
  try {
    // 1. Check RBAC
    const { authorized, response, session } = await requireAccess("resource", "action");
    if (!authorized) return response;
    const organizationId = session.user.organizationId;

    // 2. Validate input (if needed)
    const body = await request.json();
    const validated = someSchema.parse(body);

    // 3. Scope all queries by organizationId
    const data = await prisma.entity.findMany({
      where: { organizationId },
    });

    // 4. Log activity (if mutation)
    await logActivity(session, { type: "ACTIVITY_TYPE", ... });

    return apiSuccess(data);
  } catch (error) {
    return handleApiError(error, "operation description");
  }
}
```

### API Utilities (`src/lib/api/`)

All re-exported from `index.ts` for convenience:

- **`auth-middleware.ts`**
  - `requireAuth()` — Session required, no permission check
  - `requireAccess(resource, action)` — RBAC enforcement → `{ authorized, response, session }`
  - `verifyCronAuth(request)` — Cron job secret validation (Bearer token vs CRON_SECRET env)

- **`response.ts`** — Standardized HTTP responses
  - `apiSuccess(data)` → 200 OK
  - `apiCreated(data)` → 201 Created
  - `apiError(msg, code)` → Custom code (default 400)
  - `apiUnauthorized()` → 401
  - `apiForbidden()` → 403
  - `apiNotFound()` → 404
  - `apiServerError(msg)` → 500

- **`error-handler.ts`**
  - `handleApiError(error, context)` — Auto-handles Zod + Prisma errors, logs via `logger.apiError()`
  - Handles: Zod validation (→ 400), Prisma P2002 (unique), P2025 (not found), P2003 (foreign key)

- **`validation.ts`**
  - `validateRequest(request, schema)` — Validate JSON body
  - `validateSearchParams(params, schema)` — Validate URL params
  - `sanitizeSearchInput(input)` — Sanitize search strings
  - `parseEnumParam(value, enumValues)` — Parse enum from string

- **`password-verification.ts`**
  - `verifyCurrentUserPassword(userId, password)` — Verify user's current password
  - `extractPasswordFromRequest(request)` — Extract `currentPassword` from body

- **`subscription-limits.ts`**
  - `checkSubscriptionLimit(session, limitType)` — Check if can create more (users/properties/units/tenants)
  - Returns `{ allowed: boolean, message?: string }`

- **`query-helpers.ts`**
  - SELECT/INCLUDE constants for consistent queries
  - `findUserInOrganization(userId, organizationId)` — Find user, verify org membership
  - `findTenantInOrganization(tenantId, organizationId)` — Find tenant with validation

- **`lease-validation.ts`**
  - `validateLeaseAvailability(unitId, startDate, endDate, excludeLeaseId?, organizationId)` — Check overlaps
  - `canDeleteLease(lease)` — Check if DRAFT (only DRAFT can delete)
  - `calculateGracePeriodDeadline(startDate, gracePeriodDays)` — Deadline DateTime
  - `isLeaseOverdue(startDate, gracePeriodDays)` — Check if past grace

- **`activity-logger.ts`**
  - `logActivity(session, data)` — Log activity with metadata
  - `ActivityLogger.*` — Convenience methods for common activities
  - `ActivityType` enum matches Prisma schema exactly

- **`pagination.ts`**
  - `parsePaginationParams(searchParams)` → `{ page, limit }`
  - `createPaginatedResponse(items, total, page, limit)` → `{ items, pagination: { page, limit, total, totalPages } }`
  - Defaults: DEFAULT_LIMIT = 50, MAX_LIMIT = 100

### Cron Jobs (4 total)

All in `src/app/api/cron/*/route.ts`, protected by `verifyCronAuth()`, defined in `vercel.json`:

| Job | Schedule | What it does |
| --- | --- | --- |
| `/api/cron/cancel-unpaid-leases` | `0 0 * * *` (midnight UTC) | Cancel DRAFT leases past grace deadline |
| `/api/cron/process-auto-renewals` | `0 1 * * *` (1am UTC) | Create renewal DRAFT leases for auto-renew past notice deadline |
| `/api/cron/process-notifications` | `0 2 * * *` (2am UTC) | Send PAYMENT_REMINDER, PAYMENT_LATE, LEASE_EXPIRING |
| `/api/cron/end-expired-leases` | `0 3 * * *` (3am UTC) | End ACTIVE leases past endDate, trigger LEASE_EXPIRED |

**Response format:** `{ success: boolean, processed: number, details: Array<...> }`

**Auth:** All crons verify `Authorization: Bearer {CRON_SECRET}` header via `verifyCronAuth()`.

## Authentication & Authorization

### RBAC Implementation

- **API enforcement:** `requireAccess(resource, action)` in all route handlers
- **UI enforcement:** `checkPageAccess(resource, action)` in server component wrappers around client pages
- **Navigation filtering:** `hasAccess()` helper in `nav-links.tsx`
- **Roles & Accesses:** Modeled in Prisma; Owner role is system-protected (`isSystem: true`, cannot edit/delete)

### Email Verification (MailerSend)

- Email verification on signup: `sendVerificationEmail()` in `src/lib/mailersend.ts`
- Token stored on User model: `emailVerificationToken`
- Token expires 24 hours
- Routes: `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`, `/verify-email` landing page
- Env vars: `MAILERSEND_API_KEY`, `MAILERSEND_FROM_EMAIL`, `MAILERSEND_FROM_NAME`
- Unverified users: Middleware blocks access until verified

### Subscription Status

- **FREE tier:** ACTIVE immediately with endDate = 2099-12-31
- **Paid tiers:** PENDING_PAYMENT until Xendit webhook confirms payment
- **PENDING_PAYMENT users:** Can log in but middleware redirects to `/subscribe`
- Limits enforced server-side at creation time; returns 403 when exceeded

## Payment Gateway (Xendit)

- **Utility:** `src/lib/payment-gateways/xendit.ts`
- **Receipts:** `src/lib/receipt-generator.ts` (jspdf + @vercel/blob)
- **Webhook:** `POST /api/webhooks/xendit` — verified by `x-callback-token` header vs `XENDIT_WEBHOOK_TOKEN` env
- **Subscription billing:** Uses `HAVENTIUM_XENDIT_SECRET_KEY` env var (platform-level key)
- **Tenant rent collection:** Per-org keys stored encrypted in ApiKey table (`service = XENDIT`)
- **Models:** PaymentTransaction links Organization, LeaseAgreement, and Subscription

## Notifications

**Fully implemented** with Email (MailerSend), WhatsApp (Meta Cloud API), Telegram (Bot API).

### Schema & Storage

- `NotificationTemplate` — Email/WhatsApp/Telegram message templates with variables
- `NotificationRule` — Automated trigger rules with daysOffset, recipient config
- `NotificationLog` — Delivery tracking (PENDING → SENT/FAILED)
- `ApiKey` table — Encrypted org-specific API keys (AES-256-GCM with `ENCRYPTION_SECRET` env)

### Tenant Preferences

Respects `preferEmail`, `preferWhatsapp`, `preferTelegram` flags. Phone-based channels use tenant's `phone` field.

### API Key Services

`ApiKeyService` enum in Prisma schema:

- `MAILERSEND_EMAIL` — MailerSend API key for sending emails
- `WHATSAPP_META` — WhatsApp Meta Cloud API credentials JSON
- `TELEGRAM_BOT` — Telegram Bot API token
- `XENDIT` — Xendit API key for rent payment collection

### Services & Triggers

- **Email:** MailerSend API (requires org `MAILERSEND_EMAIL` API key)
- **WhatsApp:** Meta Cloud API (requires org `WHATSAPP_META` credentials JSON)
- **Telegram:** Telegram Bot API (requires org `TELEGRAM_BOT` token), **uses phone numbers as identifiers**
- **Triggers:** PAYMENT_REMINDER, PAYMENT_LATE, PAYMENT_CONFIRMED, LEASE_EXPIRING, LEASE_EXPIRED, MANUAL

### Cron Execution

- `/api/cron/process-notifications` (2am UTC) — Processes PAYMENT_REMINDER, PAYMENT_LATE, LEASE_EXPIRING
- `/api/cron/end-expired-leases` (3am UTC) — Ends ACTIVE leases, triggers LEASE_EXPIRED

## Key Domain Models

### Leases (Core Entity)

Status flow: DRAFT → ACTIVE → ENDED or CANCELLED

- **One lease = one payment period.** Recurring rentals = recurring leases via auto-renewal.
- **Payment cycle:** DAILY, MONTHLY, or ANNUAL
- **Setting `paidAt`** auto-transitions DRAFT → ACTIVE, tenant → ACTIVE
- **Frozen after ACTIVE:** `startDate`, `endDate`, `paymentCycle`, `rentAmount`, `depositAmount` cannot change
- **Auto-renewal:** `isAutoRenew` with `autoRenewalNoticeDays`; cron creates next DRAFT lease
- **Grace period:** DRAFT leases can have `gracePeriodDays`; cron cancels if overdue
- **Overlap validation:** Blocks new leases on same unit with date range overlap
- **Payment fields:** `paidAt`, `paymentDate`, `paymentMethod` (CASH, BANK_TRANSFER, VIRTUAL_ACCOUNT, QRIS, MANUAL), `paymentStatus` (PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED), `externalId`, `externalResponse`, `paymentNotes`

### Tenants

Status auto-managed by lease lifecycle (LEAD → BOOKED → ACTIVE → EXPIRED). No manual status setting.

- **Required:** `fullName`, `email`, `phone`
- **Optional:** `preferEmail`, `preferWhatsapp`, `preferTelegram` (notification preferences)

### Properties & Units

- **Property:** Building or complex
- **Unit:** Individual rental unit with optional `dailyRate`, `monthlyRate`, `annualRate` (Decimal 12,2)
- **Unit availability:** `isUnavailable` flag blocks new leases

### Subscriptions & Tiers

| Tier | Users | Properties | Units | Tenants |
| --- | --- | --- | --- | --- |
| FREE | 1 | 1 | 10 | 100 |
| NORMAL | 5 | 5 | 50 | 1000 |
| PRO | 10 | 10 | 100 | 10000 |

### Deposits

- Status: HELD → RETURNED or FORFEITED (one-way, irreversible)
- Can only change on ENDED leases that haven't been renewed and are still HELD
- Validation prevents reversal

### Maintenance Requests

- Status flow: OPEN → IN_PROGRESS → COMPLETED (or CANCELLED)
- Priority levels: LOW, MEDIUM, HIGH, URGENT
- Optional links to unit, tenant, lease
- Supports bulk import from Excel/CSV

### Documents

- File storage via Vercel Blob (max 10MB, PDF/images)
- Optional links to property, unit, tenant, lease
- Upload/download via `POST /api/documents/upload`, `GET /api/documents/[id]`

## Directory Structure

```
src/
  app/
    (auth)/              — login, signup, email verification
    (dashboard)/         — all authenticated pages
    api/
      auth/              — authentication routes
      cron/              — 4 cron jobs
      properties/        — properties & units CRUD
      tenants/           — tenants CRUD
      leases/            — leases CRUD + payments
      notifications/     — templates, rules, logs
      maintenance-requests/
      documents/
      organization/      — settings, API keys, formats
      webhooks/          — Xendit webhook
  components/
    ui/                  — shadcn/ui components
  lib/
    api/
      index.ts           — re-export point for all utilities
      auth-middleware.ts
      response.ts
      error-handler.ts
      validation.ts
      password-verification.ts
      subscription-limits.ts
      query-helpers.ts
      lease-validation.ts
      activity-logger.ts
      pagination.ts
    auth.ts / auth.config.ts  — NextAuth 5 config
    access-utils.ts      — permission checking
    logger.ts            — structured logging
    prisma.ts            — singleton Prisma client
    mailersend.ts        — email verification
    payment-gateways/
      xendit.ts          — Xendit API client
    encryption.ts        — AES-256-GCM for API keys
    format.ts            — date/currency formatting
    guards.tsx           — RBAC UI enforcement
  middleware.ts          — NextAuth route protection, subscription redirect

prisma/
  schema.prisma          — complete data model
  seed.ts                — seed data

generated/prisma/        — Prisma client (custom output location)
  enums.ts               — auto-generated enums
```

## Environment Variables

### Required

- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — JWT signing secret
- `NEXTAUTH_URL` — App URL
- `ENCRYPTION_SECRET` — 32+ chars for AES-256-GCM
- `CRON_SECRET` — Bearer token for cron jobs
- `MAILERSEND_API_KEY` — MailerSend email API key
- `MAILERSEND_FROM_EMAIL` — Sender email address
- `MAILERSEND_FROM_NAME` — Sender name (optional, defaults to "Haventium")
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `XENDIT_WEBHOOK_TOKEN` — Webhook verification
- `HAVENTIUM_XENDIT_SECRET_KEY` — Platform subscription billing key

### Per-Organization (UI-Configured, Encrypted in DB)

- `MAILERSEND_EMAIL` — MailerSend API key (stored as `ApiKeyService.MAILERSEND_EMAIL`)
- `WHATSAPP_META` — WhatsApp credentials JSON (stored as `ApiKeyService.WHATSAPP_META`)
- `TELEGRAM_BOT` — Telegram bot token (stored as `ApiKeyService.TELEGRAM_BOT`)
- `XENDIT` — Per-org Xendit key for rent collection (stored as `ApiKeyService.XENDIT`)

## Logging

- **Module:** `src/lib/logger.ts` (server-side only)
- **Use:** `logger.info()`, `logger.error()`, `logger.apiError()`, `logger.cronError()`, `logger.cronInfo()`
- **Never** use `console.log/error/warn` in production code
- Errors logged automatically by `handleApiError()` with full context

## Bulk Import

Entities support Excel/CSV bulk import:

- `POST /api/properties/bulk-import`
- `POST /api/tenants/bulk-import`
- `POST /api/leases/bulk-import?dryRun=true` (supports dry-run)
- `POST /api/maintenance-requests/bulk-import`

Validates subscription limits before import, returns detailed success/failure report per row.

## Common Patterns to Avoid

- **Don't skip `organizationId` in Prisma queries.** Always scope by org.
- **Don't set tenant status directly.** Status is auto-managed by lease lifecycle.
- **Don't modify frozen lease fields.** After a lease becomes ACTIVE, `startDate`, `endDate`, `paymentCycle`, `rentAmount`, `depositAmount` are locked.
- **Don't delete ACTIVE/ENDED leases.** Only DRAFT leases can be deleted.
- **Don't use `console.log` for logging.** Use `logger` from `@/lib/api`.
- **Don't trust client input.** Validate and enforce business rules server-side.
- **Don't run migrations manually.** Developer-only responsibility.
- **Don't commit Prisma migrations without `prisma generate`.** Client must be regenerated.

## Testing & Development

- **Dev server:** `pnpm dev` → http://localhost:3000
- **Build:** `pnpm build` → `pnpm start`
- **Lint:** `pnpm lint`
- **Database:** PostgreSQL via environment variable
- **Seed data:** `pnpm prisma db seed` (calls `prisma/seed.ts`)
- **Generate Prisma client:** `pnpm prisma generate` (runs on `postinstall`)
