# Haventium

Rental property management CRM. Multi-tenant SaaS where every piece of data is scoped to an organization — every Prisma query must include `organizationId` in its `where` clause.

## Development Rules

- **Never run Prisma migrations** (`prisma migrate dev`, `prisma db push`, etc.) — the developer handles all migrations manually.

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

### Notifications

Schema is fully modeled (NotificationTemplate, NotificationRule, NotificationLog with triggers like PAYMENT_REMINDER, LEASE_EXPIRING, etc.) but no UI or sending logic exists yet.

### RBAC

**Fully implemented** throughout API and UI. Roles, accesses, and user-role associations are modeled in the schema. The Owner role is system-protected (`isSystem: true`) and cannot be edited or deleted.

**Permission model:**

| Resource | Actions |
|---|---|
| properties | read, create, update, delete |
| tenants | read, create, update, delete |
| leases | read, create, update, delete |
| settings | manage (roles/accesses) |
| users | manage |

**API enforcement:** All route handlers use `checkAccess(resource, action)` from `src/lib/guards.ts`. It returns `{ authorized, response, session }` — handlers check `!authorized` and return the response (403 with error message). Session data is returned for convenience.

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
src/lib/                  — auth config, prisma client, utilities
src/middleware.ts         — NextAuth route protection
prisma/schema.prisma      — database schema
prisma/seed.ts            — seed data
generated/prisma/         — generated Prisma client + types
```

### Auth & Middleware

NextAuth 5 (beta) with Credentials provider only. JWT session strategy — session carries `id`, `organizationId`, subscription (with tier), and roles (with accesses).

Middleware protects all routes except: `/login`, `/signup`, `/api/signup`, `/api/auth/**`, `/api/cron/**`. Unauthenticated requests redirect to `/login?callbackUrl=...`. Dashboard layout has a secondary server-side `auth()` check.

Password requirements: min 8 chars, lowercase, uppercase, digit, special char (`@$!%*?&`).

### API Patterns

Route handlers in `src/app/api/`. Every handler:
1. Calls `checkAccess(resource, action)` from `src/lib/guards.ts` for RBAC enforcement
2. If `!authorized`, returns the 403 response immediately
3. Extracts `organizationId` from `session.user.organizationId` (session returned by `checkAccess`)
4. Validates input with inline Zod schemas
5. Scopes all queries by `organizationId`
6. Returns Zod validation errors as `{ error: issues[0].message }` with status 400

**Example pattern:**
```typescript
const { authorized, response, session } = await checkAccess('properties', 'create');
if (!authorized) return response;
const organizationId = session.user.organizationId;
```

Business rules are always enforced server-side — never trust the client.

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
