# Implementation Plan: Payment Gateway (Xendit Payment Links)

## Context

Two distinct payment flows:

1. **Rent Collection** (Organization → Renter): Cron automatically generates Xendit payment links and sends them to tenants via WhatsApp as part of the existing `PAYMENT_REMINDER` notification flow.
2. **Subscription Payment** (User → Haventium): At signup, if the selected tier has a price > 0 in `SubscriptionTier.monthlyPrice` / `annualPrice`, payment via Xendit is required before the org is activated.

**Payment method:** Xendit Payment Links (hosted page) only — Xendit handles payment method selection on their end.

**Xendit API Reference:** https://docs.xendit.co/docs/payment-links-api-overview

---

## Credentials (Dev/Test)

- **Secret Key:** `xnd_development_hmxmtSgQlExGUIoPkjjYR2tooELnCVsO8mQz8HHpjQVK2kv0JwMVIevqu6fHX`
- **Public Key:** `xnd_public_development_zwKop2J0c62qKKAUmCyPPZedpd19VnEvhHBFdwHN6g788To5UE__1v8cXipUbVw`
- **Webhook Token:** `q6qDHFI2BS5pi6ETll1TXySS3FHUgGxCIcV3hT6IacBIqa6g`

---

## Flow 1: Rent Collection (Organization → Renter via Cron)

### What happens

The existing `PAYMENT_REMINDER` cron (`/api/cron/process-notifications`, 2am UTC) is extended to **also generate a Xendit payment link** and send it to the tenant via WhatsApp when processing a reminder. No manual action from the manager is needed.

**Reminder flow:**

1. Cron finds leases where a payment reminder is due (existing logic in `processPaymentReminders`)
2. For each lease, instead of just sending a text notification, the cron:
   a. Checks if org has a Xendit API key configured
   b. If yes: creates a Xendit payment link for that lease's `rentAmount` (idempotent — reuses existing PENDING link if one exists)
   c. Sends the payment link URL via WhatsApp to the tenant (using existing `sendWhatsApp()`)
   d. Falls back to plain text reminder if no Xendit key is configured
3. Tenant receives WhatsApp message with a clickable payment link
4. Tenant pays on Xendit's hosted page
5. Xendit webhook fires → lease activated, receipt generated

**Manager can also manually trigger** from the lease detail page (send payment link on demand) — but the primary channel is automated via cron.

### Database Schema Changes

**Add to `prisma/schema.prisma`:**

```prisma
model PaymentTransaction {
  id                String                 @id @default(cuid())
  organizationId    String
  organization      Organization           @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Rent payment
  leaseId           String?
  lease             LeaseAgreement?        @relation(fields: [leaseId], references: [id], onDelete: SetNull)

  // Subscription payment (Haventium billing)
  subscriptionId    String?
  subscription      Subscription?          @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  type              PaymentTransactionType @default(RENT)
  gateway           PaymentGateway         @default(XENDIT)
  externalId        String                 @unique   // our external_id sent to Xendit
  xenditInvoiceId   String?                          // Xendit's internal invoice id
  paymentLinkUrl    String?                @db.Text  // Xendit hosted payment page URL
  amount            Decimal                @db.Decimal(12, 2)
  status            PaymentStatus          @default(PENDING)
  externalResponse  Json?

  // Receipt (generated after payment confirmed)
  receiptUrl        String?
  receiptStorageKey String?

  webhookReceivedAt DateTime?
  paidAt            DateTime?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  @@index([organizationId])
  @@index([leaseId])
  @@index([subscriptionId])
  @@index([externalId])
  @@index([status])
}

enum PaymentTransactionType {
  RENT
  SUBSCRIPTION
}

enum PaymentGateway {
  XENDIT
}
```

**Extend existing enums:**

```prisma
// ApiKeyService — add XENDIT for per-org rent collection credentials
enum ApiKeyService {
  RESEND_EMAIL
  WHATSAPP_META
  TELEGRAM_BOT
  XENDIT          // NEW
}

// New ActivityType values to add to the existing enum:
// PAYMENT_LINK_CREATED
// PAYMENT_WEBHOOK_RECEIVED
// RECEIPT_GENERATED
```

**Add relations:**

```prisma
// In Organization model
paymentTransactions PaymentTransaction[]

// In LeaseAgreement model
paymentTransactions PaymentTransaction[]

// In Subscription model
paymentTransactions PaymentTransaction[]
```

### Xendit Integration Utility

**Install dependencies:**

```bash
pnpm add xendit-node jspdf
```

**Create `src/lib/payment-gateways/xendit.ts`:**

```typescript
import Xendit from "xendit-node";

export interface CreatePaymentLinkParams {
  apiKey: string;
  externalId: string;         // our unique ref (e.g. "rent-{leaseId}-{timestamp}")
  amount: number;
  payerEmail?: string;
  description: string;        // e.g. "Rent - Unit A1 (Feb 2026)"
  currency?: string;          // defaults to "IDR"
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
}

export async function createXenditPaymentLink(params: CreatePaymentLinkParams) {
  const xendit = new Xendit({ secretKey: params.apiKey });

  const invoice = await xendit.Invoice.createInvoice({
    externalID: params.externalId,
    amount: params.amount,
    payerEmail: params.payerEmail,
    description: params.description,
    currency: params.currency ?? "IDR",
    successRedirectURL: params.successRedirectUrl,
    failureRedirectURL: params.failureRedirectUrl,
  });

  return {
    xenditInvoiceId: invoice.id,
    paymentLinkUrl: invoice.invoice_url,
    externalId: invoice.external_id,
    externalResponse: invoice as unknown as Record<string, unknown>,
  };
}

export function verifyXenditWebhook(
  callbackToken: string,
  webhookToken: string,
): boolean {
  return callbackToken === webhookToken;
}
```

### Cron Extension — `processPaymentReminders`

**Modify `src/app/api/cron/process-notifications/route.ts`:**

The existing `processPaymentReminders` function already finds leases and calls `processNotifications()`. Extend it so that for each lease due for a reminder, before/alongside the notification:

1. Look up the org's Xendit API key (decrypt from `ApiKey` table where `service = XENDIT`)
2. If found:
   - Check for existing `PaymentTransaction` with `leaseId = lease.id` and `status = PENDING` — reuse it if it exists (idempotent)
   - Otherwise create a new Xendit payment link via `createXenditPaymentLink()`
   - Save `PaymentTransaction` record
3. Pass `paymentLinkUrl` into the notification template variables as `{{paymentLink}}`
4. `processNotifications()` will deliver via WhatsApp (and email/Telegram if configured) with the link embedded in the message body

**Template variable added:** `{{paymentLink}}` — the Xendit hosted payment URL. When no Xendit key is configured, this variable is empty and the message is sent as a plain reminder.

**WhatsApp message example:**

> Halo {{tenantName}}, pembayaran sewa Anda untuk {{unitName}} jatuh tempo pada {{leaseEndDate}}.
> Silakan lakukan pembayaran melalui link berikut:
> {{paymentLink}}
> Terima kasih.

### Manual Payment Link — Lease Detail Page

In addition to the automated cron, managers can generate/view the payment link on demand.

**Create `src/app/api/leases/[id]/create-payment-link/route.ts`:**

**Method:** POST
**RBAC:** `requireAccess("leases", "update")`

**Logic:**

1. Fetch lease with tenant, unit, property (scoped by `organizationId`)
2. Verify lease is `DRAFT` and `paidAt` is null
3. Check for existing `PaymentTransaction` with `leaseId` and `status = PENDING` — return existing if found (idempotent)
4. Fetch org's Xendit API key from `ApiKey` table, decrypt it
5. Call `createXenditPaymentLink()`:
   - `externalId`: `"rent-{leaseId}-{Date.now()}"`
   - `description`: `"Rent - {propertyName} Unit {unitName} ({startDate} to {endDate})"`
   - `amount`: `lease.rentAmount` (converted to number)
   - `payerEmail`: `tenant.email`
6. Create `PaymentTransaction` record (`type = RENT`, `status = PENDING`)
7. Log activity: `PAYMENT_LINK_CREATED`
8. Return `{ paymentLinkUrl, transactionId }`

**Create `src/app/api/leases/[id]/payments/route.ts`:**

**Method:** GET
**RBAC:** `requireAccess("leases", "read")`

Returns all `PaymentTransaction` records for the lease, including `status`, `paymentLinkUrl`, `receiptUrl`, `paidAt`.

### Xendit Webhook Handler

**Create `src/app/api/webhooks/xendit/route.ts`:**

**Method:** POST (no auth middleware — verified by token header)

**Webhook payload (from Xendit):**

```json
{
  "id": "579c8d61f23fa4ca35e52da4",
  "external_id": "rent-lease123-1738000000000",
  "status": "PAID",
  "payment_method": "BANK_TRANSFER",
  "amount": 50000,
  "paid_amount": 50000,
  "bank_code": "PERMATA",
  "paid_at": "2026-01-12T08:15:03.404Z",
  "payer_email": "tenant@example.com",
  "description": "Rent - Property A Unit A1",
  "currency": "IDR",
  "payment_channel": "PERMATA",
  "payment_destination": "888888888888"
}
```

**Logic:**

1. Verify `x-callback-token` header matches `XENDIT_WEBHOOK_TOKEN` env var — return 401 if invalid
2. If `status !== "PAID"`, return 200 immediately (ignore non-payment events)
3. Find `PaymentTransaction` by `externalId` — return 200 if not found (unknown transaction)
4. If `status === COMPLETED` already, return 200 (idempotent)
5. Route by `PaymentTransaction.type`:

**RENT branch:**
- Update `PaymentTransaction`: `status = COMPLETED`, `paidAt = paid_at from payload`, `webhookReceivedAt = now`, `externalResponse = full payload`
- Update `LeaseAgreement` in same DB transaction:
  - `paidAt = paid_at`
  - `paymentStatus = COMPLETED`
  - `paymentMethod` = map Xendit `payment_method` → our `PaymentMethod` enum
  - `status = ACTIVE` (DRAFT → ACTIVE)
  - `paymentDate = now`
  - `externalId = PaymentTransaction.externalId`
- Update Tenant status to `ACTIVE` via existing tenant status logic
- Generate receipt PDF via `generateRentReceipt()` → Vercel Blob → update `PaymentTransaction.receiptUrl`
- Log `PAYMENT_WEBHOOK_RECEIVED`, `RECEIPT_GENERATED`
- Trigger `PAYMENT_CONFIRMED` notification (fire-and-forget, non-blocking)

**SUBSCRIPTION branch:**
- Update `PaymentTransaction`: `status = COMPLETED`, `paidAt`, `webhookReceivedAt`
- Update `Subscription`: `status = ACTIVE`, `currentPeriodStart = now`, `currentPeriodEnd` based on `billingCycle`
- Log activity

6. Return 200 OK always (Xendit retries on non-200)

### Receipt Generation

**Create `src/lib/receipt-generator.ts`:**

```typescript
import jsPDF from "jspdf";
import { put } from "@vercel/blob";

export async function generateRentReceipt(params: {
  organizationName: string;
  organizationCurrencySymbol: string;
  tenantName: string;
  propertyName: string;
  unitName: string;
  rentAmount: string;
  paidAt: Date;
  paymentMethod: string;
  transactionId: string;
  leaseStartDate: string;
  leaseEndDate: string;
}): Promise<{ url: string; storageKey: string }> {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT RECEIPT", 105, 20, { align: "center" });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(params.organizationName, 105, 32, { align: "center" });

  doc.setLineWidth(0.5);
  doc.line(20, 40, 190, 40);

  doc.setFontSize(10);
  doc.text(`Transaction ID: ${params.transactionId}`, 20, 52);
  doc.text(`Date Paid: ${params.paidAt.toLocaleDateString()}`, 20, 60);
  doc.text(`Payment Method: ${params.paymentMethod}`, 20, 68);

  doc.setFontSize(11);
  doc.text("Tenant:", 20, 82);
  doc.setFontSize(10);
  doc.text(`Name: ${params.tenantName}`, 20, 90);
  doc.text(`Property: ${params.propertyName}`, 20, 98);
  doc.text(`Unit: ${params.unitName}`, 20, 106);

  doc.setFontSize(11);
  doc.text("Lease Period:", 20, 120);
  doc.setFontSize(10);
  doc.text(`${params.leaseStartDate} — ${params.leaseEndDate}`, 20, 128);

  doc.setLineWidth(0.3);
  doc.line(20, 140, 190, 140);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Total Paid:", 20, 152);
  doc.text(
    `${params.organizationCurrencySymbol}${params.rentAmount}`,
    190,
    152,
    { align: "right" },
  );

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("Thank you for your payment!", 105, 180, { align: "center" });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `receipts/rent-${params.transactionId}.pdf`;
  const blob = await put(filename, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
  });

  return { url: blob.url, storageKey: filename };
}
```

### UI Updates — Lease Detail Page

**Modify `src/app/(dashboard)/leases/[id]/lease-detail-client.tsx`:**

- Fetch `PaymentTransaction` list for the lease on mount (GET `/api/leases/[id]/payments`)
- Show **payment link section** if a `PENDING` transaction exists:
  - Display the link (read-only, copyable)
  - **"Send via WhatsApp"** button — opens `wa.me/{phone}?text=...` with link in message (client-side deep link, no API call)
  - Shows transaction status badge
- Show **"Create Payment Link"** button if no PENDING transaction and lease is `DRAFT` and unpaid
- Show **receipt download** link if transaction is `COMPLETED` and `receiptUrl` is set
- Only show payment section if org has Xendit API key configured (check from org settings)

**WhatsApp send (client-side only):**

```typescript
function sendPaymentViaWhatsApp(phone: string, paymentLinkUrl: string, tenantName: string) {
  const msg = `Halo ${tenantName},\n\nBerikut link pembayaran sewa Anda:\n${paymentLinkUrl}\n\nTerima kasih.`;
  window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
}
```

---

## Flow 2: Subscription Payment (Signup Integration)

### Trigger condition

Payment is required at signup **if and only if** the selected tier's price in `SubscriptionTier` is > 0 for the chosen billing cycle:

- `SubscriptionTier.monthlyPrice > 0` → payment required for monthly billing
- `SubscriptionTier.annualPrice > 0` → payment required for annual billing

This means FREE tier (price = 0) skips payment entirely, regardless of tier name. If prices change in the DB, the behavior adapts automatically — no hardcoded tier names.

### Schema Change

Add `PENDING_PAYMENT` to the existing `SubscriptionStatus` enum:

```prisma
enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  EXPIRED
  TRIAL
  PENDING_PAYMENT   // NEW — org created, awaiting first payment
}
```

Users whose subscription is `PENDING_PAYMENT` are blocked from logging in (existing login check already rejects non-ACTIVE subscriptions).

### Haventium's Xendit Credentials (Environment Variables)

These are Haventium's own credentials — used only for subscription billing, not per-org rent collection.

```
HAVENTIUM_XENDIT_SECRET_KEY=xnd_production_...
XENDIT_WEBHOOK_TOKEN=q6qDHFI2BS5pi6ETll1TXySS3FHUgGxCIcV3hT6IacBIqa6g
```

`XENDIT_WEBHOOK_TOKEN` is global — Xendit sends the same token regardless of which secret key created the invoice.

### Signup API Changes

**Modify `src/app/api/signup/route.ts`:**

**Extended input:**

```typescript
{
  organizationName: string;
  fullName: string;
  email: string;
  password: string;
  tierId: string;           // NEW — SubscriptionTier.id selected by user
  billingCycle: "MONTHLY" | "ANNUAL";  // NEW (matches BillingCycle enum)
}
```

**Logic:**

```
1. Fetch SubscriptionTier by tierId
2. Determine price = billingCycle === "MONTHLY" ? tier.monthlyPrice : tier.annualPrice

if price === 0:
  → create Organization, User, Subscription (status = ACTIVE) in DB transaction
  → return { success: true, redirect: "/dashboard" }

if price > 0:
  → create Organization, User, Subscription (status = PENDING_PAYMENT) in DB transaction
  → create PaymentTransaction (type = SUBSCRIPTION, status = PENDING, subscriptionId)
  → call createXenditPaymentLink() using HAVENTIUM_XENDIT_SECRET_KEY:
      externalId: "sub-{subscriptionId}-{timestamp}"
      amount: Number(price)
      description: "Haventium {tier.name} Subscription ({billingCycle})"
      payerEmail: user.email
      successRedirectUrl: "{NEXTAUTH_URL}/signup/success"
      failureRedirectUrl: "{NEXTAUTH_URL}/signup/payment-failed"
  → update PaymentTransaction with xenditInvoiceId, paymentLinkUrl
  → return { paymentLinkUrl }   // client redirects browser to Xendit hosted page

Note: If Xendit call fails, roll back entire DB transaction so user can retry signup cleanly.
```

### Signup UI Changes

**Modify `src/app/(auth)/signup/page.tsx`:**

Add a **tier selection step** that fetches available tiers from the DB:

```
Step 1: Org name, full name, email, password
Step 2: Choose plan
  Fetch GET /api/subscription-tiers → display cards with name, limits, price

  Each card shows:
  - Tier name
  - Monthly / Annual price (from DB)
  - Key limits (maxProperties, maxUnits, maxTenants)

  Billing cycle toggle: Monthly | Annual

  [Continue] button

if selected tier price === 0:
  → submit → POST /api/signup → redirect to /dashboard

if selected tier price > 0:
  → submit → POST /api/signup → receive { paymentLinkUrl } → redirect browser to paymentLinkUrl
```

**Add `src/app/api/subscription-tiers/route.ts`:**

Public GET endpoint (no auth required) — returns all `SubscriptionTier` rows with `type`, `name`, `monthlyPrice`, `annualPrice`, and limits. Used by the signup page to render tier cards dynamically.

**Add `src/app/(auth)/signup/success/page.tsx`:**

```
Payment successful! Your Haventium account is active.
[Go to Dashboard]
```

**Add `src/app/(auth)/signup/payment-failed/page.tsx`:**

```
Payment was not completed. Your account exists but is inactive.
Contact support or try signing up again.
```

---

## Critical Files

### New Files

- `src/lib/payment-gateways/xendit.ts` — `createXenditPaymentLink()`, `verifyXenditWebhook()`
- `src/lib/receipt-generator.ts` — `generateRentReceipt()`
- `src/app/api/webhooks/xendit/route.ts` — Unified webhook handler (RENT + SUBSCRIPTION)
- `src/app/api/leases/[id]/create-payment-link/route.ts` — Manual payment link creation
- `src/app/api/leases/[id]/payments/route.ts` — Payment transaction list for a lease
- `src/app/api/subscription-tiers/route.ts` — Public tier listing for signup page
- `src/app/(auth)/signup/success/page.tsx`
- `src/app/(auth)/signup/payment-failed/page.tsx`

### Modified Files

- `prisma/schema.prisma` — Add `PaymentTransaction` model, `PaymentTransactionType`, `PaymentGateway` enums; add `PENDING_PAYMENT` to `SubscriptionStatus`; add `XENDIT` to `ApiKeyService`; add new `ActivityType` values; add relations
- `src/app/api/cron/process-notifications/route.ts` — Extend `processPaymentReminders` to generate+attach Xendit payment link when sending WhatsApp reminder
- `src/app/api/signup/route.ts` — Accept `tierId` + `billingCycle`, check tier price, conditionally create Xendit payment link
- `src/app/api/organization/api-keys/route.ts` — Support `XENDIT` in service enum validation
- `src/app/api/organization/api-keys/[id]/test/route.ts` — Add Xendit test (call Xendit balance/list endpoint)
- `src/app/(auth)/signup/page.tsx` — Add tier selection step with dynamic pricing from DB
- `src/app/(dashboard)/leases/[id]/lease-detail-client.tsx` — Add payment link section, WhatsApp send button, receipt download
- `src/app/(dashboard)/organization/settings-client.tsx` — Add Payment Gateway tab for Xendit key config
- `src/lib/services/notification-processor.ts` — Add `{{paymentLink}}` as a template variable
- `package.json` — Add `xendit-node`, `jspdf`

---

## Environment Variables

| Variable | Purpose | Scope |
|---|---|---|
| `XENDIT_WEBHOOK_TOKEN` | Verify all Xendit webhook callbacks | Global |
| `HAVENTIUM_XENDIT_SECRET_KEY` | Create subscription payment links | Global (Haventium billing) |

**Per-org Xendit credentials** (rent collection) stored encrypted in `ApiKey` table with `service = XENDIT`.

---

## Security

- Webhook token verified before any DB write — return 401 on mismatch
- Amount for rent taken from `PaymentTransaction.amount` (DB) not from Xendit payload — prevents tampering
- `externalId` is globally unique — idempotency guard against duplicate webhook deliveries
- All lease/payment queries scoped by `organizationId`
- RBAC enforced: `requireAccess("leases", "update")` on payment link creation
- Subscription payments use Haventium's global env var key, never org keys
- No sensitive data in receipt PDFs — safe for public Vercel Blob storage

---

## Verification Checklist

### Rent Collection (Cron-driven)

- [ ] Configure Xendit test API key in org Settings → Payment Gateways tab
- [ ] Create a `PAYMENT_REMINDER` notification rule with a WhatsApp template containing `{{paymentLink}}`
- [ ] Trigger the cron manually → verify `PaymentTransaction` created with `status = PENDING`
- [ ] Verify WhatsApp message sent with the Xendit payment link URL embedded
- [ ] Cron runs again → verify same link reused (idempotent, no duplicate transactions)
- [ ] Simulate Xendit webhook: POST `/api/webhooks/xendit` with `"status": "PAID"` + correct `external_id`
- [ ] Verify lease → `ACTIVE`, `paidAt` set
- [ ] Verify `PaymentTransaction.status = COMPLETED`, `receiptUrl` populated
- [ ] Verify `PAYMENT_CONFIRMED` notification fired

### Manual Payment Link (Lease Detail)

- [ ] Open DRAFT lease → "Create Payment Link" button visible (Xendit key configured)
- [ ] Click → link displayed and copyable
- [ ] "Send via WhatsApp" opens `wa.me` deep link with pre-filled message
- [ ] Button absent when no Xendit key configured

### Subscription Flow

- [ ] Signup page shows tier cards with prices fetched from DB
- [ ] Select tier with price = 0 → org created, redirected to dashboard immediately
- [ ] Select tier with price > 0 → redirected to Xendit payment page
- [ ] Complete payment → redirected to `/signup/success`
- [ ] Simulate webhook → `Subscription.status = ACTIVE`, `PaymentTransaction.status = COMPLETED`
- [ ] Log in while `PENDING_PAYMENT` → blocked with clear message

---

## Dependencies

- Receipt generation uses org `currencySymbol` from `Organization` settings
- Rent webhook triggers existing `PAYMENT_CONFIRMED` notification (existing trigger, no changes)
- `{{paymentLink}}` template variable added to notification processor — backward-compatible (empty string if no Xendit key)
- Signup tier selection is fully DB-driven via `SubscriptionTier.monthlyPrice` / `annualPrice` — no hardcoded prices in code
