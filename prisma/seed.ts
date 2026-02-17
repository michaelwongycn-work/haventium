import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import "dotenv/config"

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Starting seed...")

  // Cleanup existing data to avoid duplicates when using .create()
  console.log("🧹 Cleaning up existing data...")
  await prisma.leaseAgreement.deleteMany({})
  await prisma.activity.deleteMany({})
  await prisma.tenant.deleteMany({})
  await prisma.unit.deleteMany({})
  await prisma.property.deleteMany({})
  console.log("✓ Cleanup finished")

  // Create subscription tiers
  const freeTier = await prisma.subscriptionTier.upsert({
    where: { type: "FREE" },
    update: {},
    create: {
      type: "FREE",
      name: "Free Plan",
      monthlyPrice: 0,
      annualPrice: 0,
      maxUsers: 1,
      maxProperties: 1,
      maxUnits: 10,
      maxTenants: 10,
    },
  })
  console.log("✓ Created Free tier")

  const normalTier = await prisma.subscriptionTier.upsert({
    where: { type: "NORMAL" },
    update: {},
    create: {
      type: "NORMAL",
      name: "Normal Plan",
      monthlyPrice: 29,
      annualPrice: 290,
      maxUsers: 5,
      maxProperties: 3,
      maxUnits: 100,
      maxTenants: 100,
    },
  })
  console.log("✓ Created Normal tier")

  const proTier = await prisma.subscriptionTier.upsert({
    where: { type: "PRO" },
    update: {},
    create: {
      type: "PRO",
      name: "Pro Plan",
      monthlyPrice: 99,
      annualPrice: 990,
      maxUsers: -1, // -1 = unlimited
      maxProperties: -1,
      maxUnits: -1,
      maxTenants: -1,
    },
  })
  console.log("✓ Created Pro tier")

  // Create features
  const emailNotify = await prisma.feature.upsert({
    where: { code: "EMAIL_NOTIFY" },
    update: {},
    create: {
      code: "EMAIL_NOTIFY",
      name: "Email Notifications",
    },
  })

  const whatsappNotify = await prisma.feature.upsert({
    where: { code: "WHATSAPP_NOTIFY" },
    update: {},
    create: {
      code: "WHATSAPP_NOTIFY",
      name: "WhatsApp Notifications",
    },
  })

  const advancedReports = await prisma.feature.upsert({
    where: { code: "ADVANCED_REPORTS" },
    update: {},
    create: {
      code: "ADVANCED_REPORTS",
      name: "Advanced Reports",
    },
  })


  // Link features to tiers
  // FREE tier: Email notifications only
  await prisma.tierFeature.upsert({
    where: {
      tierId_featureId: {
        tierId: freeTier.id,
        featureId: emailNotify.id,
      },
    },
    update: {},
    create: {
      tierId: freeTier.id,
      featureId: emailNotify.id,
    },
  })

  // NORMAL tier: Email + WhatsApp
  await prisma.tierFeature.upsert({
    where: {
      tierId_featureId: {
        tierId: normalTier.id,
        featureId: emailNotify.id,
      },
    },
    update: {},
    create: {
      tierId: normalTier.id,
      featureId: emailNotify.id,
    },
  })

  await prisma.tierFeature.upsert({
    where: {
      tierId_featureId: {
        tierId: normalTier.id,
        featureId: whatsappNotify.id,
      },
    },
    update: {},
    create: {
      tierId: normalTier.id,
      featureId: whatsappNotify.id,
    },
  })

  // PRO tier: All features
  const proFeatures = [
    emailNotify,
    whatsappNotify,
    advancedReports,
  ]

  for (const feature of proFeatures) {
    await prisma.tierFeature.upsert({
      where: {
        tierId_featureId: {
          tierId: proTier.id,
          featureId: feature.id,
        },
      },
      update: {},
      create: {
        tierId: proTier.id,
        featureId: feature.id,
      },
    })
  }

  // Create default accesses
  const defaultAccesses = [
    { resource: "tenants", action: "create" },
    { resource: "tenants", action: "read" },
    { resource: "tenants", action: "update" },
    { resource: "tenants", action: "delete" },
    { resource: "properties", action: "create" },
    { resource: "properties", action: "read" },
    { resource: "properties", action: "update" },
    { resource: "properties", action: "delete" },
    { resource: "leases", action: "create" },
    { resource: "leases", action: "read" },
    { resource: "leases", action: "update" },
    { resource: "leases", action: "delete" },
    { resource: "payments", action: "read" },
    { resource: "payments", action: "update" },
    { resource: "settings", action: "manage" },
    { resource: "users", action: "manage" },
  ]

  const accesses = []
  for (const accessData of defaultAccesses) {
    const access = await prisma.access.upsert({
      where: {
        resource_action: {
          resource: accessData.resource,
          action: accessData.action,
        },
      },
      update: {},
      create: accessData,
    })
    accesses.push(access)
  }
  console.log("✓ Created default accesses")

  // Create Test Organization
  const org = await prisma.organization.upsert({
    where: { id: "test-org-id" }, // Using a fixed ID for consistency in local dev
    update: { name: "Haventium Test Org" },
    create: {
      id: "test-org-id",
      name: "Haventium Test Org",
    },
  })
  console.log("✓ Created Test Organization")

  // Create Subscription for the Org
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: { tierId: proTier.id },
    create: {
      organizationId: org.id,
      tierId: proTier.id,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month
    },
  })
  console.log("✓ Created PRO Subscription for Test Org")

  // Create Owner Role for Org
  const ownerRole = await prisma.role.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Owner",
      },
    },
    update: { isSystem: true },
    create: {
      name: "Owner",
      isSystem: true,
      organizationId: org.id,
    },
  })

  // Link all accesses to Owner role
  for (const access of accesses) {
    await prisma.roleAccess.upsert({
      where: {
        roleId_accessId: {
          roleId: ownerRole.id,
          accessId: access.id,
        },
      },
      update: {},
      create: {
        roleId: ownerRole.id,
        accessId: access.id,
      },
    })
  }
  console.log("✓ Created Owner Role and linked all accesses")

  // Create Test User
  const email = "test@test.com"
  const hashedPassword = await bcrypt.hash("Password1!", 10)
  const testUser = await prisma.user.upsert({
    where: { email },
    update: { hashedPassword },
    create: {
      email,
      name: "Test User",
      hashedPassword,
      organizationId: org.id,
    },
  })

  // Assign Owner role to user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: testUser.id,
        roleId: ownerRole.id,
      },
    },
    update: {},
    create: {
      userId: testUser.id,
      roleId: ownerRole.id,
    },
  })
  console.log(`✓ Created user ${email} and assigned Owner role`)

  // Create Properties
  const grandView = await prisma.property.create({
    data: {
      name: "Grand View Apartments",
      organizationId: org.id,
      units: {
        create: [
          { name: "Unit 101", monthlyRate: 1500, annualRate: 17000 },
          { name: "Unit 102", monthlyRate: 1600, annualRate: 18000 },
          { name: "Unit 201", monthlyRate: 2000, annualRate: 22000 },
          { name: "Penthouse A", monthlyRate: 5000, annualRate: 55000 },
        ]
      }
    },
    include: { units: true }
  })

  const sunsetVillas = await prisma.property.create({
    data: {
      name: "Sunset Villas",
      organizationId: org.id,
      units: {
        create: [
          { name: "Villa 1", dailyRate: 150, monthlyRate: 3500 },
          { name: "Villa 2", dailyRate: 150, monthlyRate: 3500 },
          { name: "Villa 3", dailyRate: 200, monthlyRate: 4500 },
        ]
      }
    },
    include: { units: true }
  })
  console.log("✓ Created 2 Properties and 7 Units")

  const unit101 = grandView.units.find(u => u.name === "Unit 101")!
  const unit102 = grandView.units.find(u => u.name === "Unit 102")!
  const unit201 = grandView.units.find(u => u.name === "Unit 201")!
  const penthouseA = grandView.units.find(u => u.name === "Penthouse A")!
  const villa1 = sunsetVillas.units.find(u => u.name === "Villa 1")!
  const villa2 = sunsetVillas.units.find(u => u.name === "Villa 2")!

  // Create Tenants
  const johnDoe = await prisma.tenant.create({
    data: {
      fullName: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      status: "ACTIVE",
      organizationId: org.id,
    }
  })

  const janeSmith = await prisma.tenant.create({
    data: {
      fullName: "Jane Smith",
      email: "jane@example.com",
      phone: "+0987654321",
      status: "ACTIVE",
      organizationId: org.id,
    }
  })

  const bobWilson = await prisma.tenant.create({
    data: {
      fullName: "Bob Wilson",
      email: "bob@example.com",
      phone: "+1122334455",
      status: "LEAD",
      organizationId: org.id,
    }
  })
  console.log("✓ Created 3 Tenants")

  // ===========================================
  // Create Leases — test data for all UI states
  // ===========================================

  // Helper: create a date offset from today by N days
  const now = new Date()
  const daysFromNow = (days: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    return d
  }

  // Test: DRAFT lease shows edit/delete buttons on list page, no deposit edit on detail
  // --- Case 1: DRAFT lease (unpaid) ---
  await prisma.leaseAgreement.create({
    data: {
      tenantId: bobWilson.id,
      unitId: villa2.id,
      organizationId: org.id,
      startDate: daysFromNow(20),   // starts in ~3 weeks
      endDate: daysFromNow(50),     // ends in ~7 weeks
      paymentCycle: "MONTHLY",
      rentAmount: 3500,
      depositAmount: 7000,
      status: "DRAFT",
    },
  })
  console.log("✓ Created lease: DRAFT (Bob Wilson / Villa 2)")

  // Test: auto-renewal toggle is enabled — user can turn it OFF
  // Notice deadline = endDate - 10 days = ~50 days from now, well in the future
  // --- Case 2: ACTIVE lease — auto-renewal ON, notice period NOT passed ---
  await prisma.leaseAgreement.create({
    data: {
      tenantId: bobWilson.id,
      unitId: unit201.id,
      organizationId: org.id,
      startDate: daysFromNow(-30),  // started 30 days ago
      endDate: daysFromNow(60),     // ends in 60 days
      paymentCycle: "MONTHLY",
      rentAmount: 2000,
      depositAmount: 4000,
      isAutoRenew: true,
      gracePeriodDays: 3,
      autoRenewalNoticeDays: 10,    // deadline = endDate - 10 = 50 days from now
      status: "ACTIVE",
      paidAt: daysFromNow(-30),
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "COMPLETED",
    },
  })
  console.log("✓ Created lease: ACTIVE, auto-renewal ON, notice NOT passed (Bob Wilson / Unit 201)")

  // Test: auto-renewal toggle is DISABLED — notice deadline already passed
  // This lease already has a renewal (renewedTo), so the cron will skip it.
  // endDate = 3 days from now, notice = 10 days → deadline was 7 days ago
  // --- Case 3: ACTIVE lease — auto-renewal ON, notice period PASSED ---
  const case3Lease = await prisma.leaseAgreement.create({
    data: {
      tenantId: johnDoe.id,
      unitId: penthouseA.id,
      organizationId: org.id,
      startDate: daysFromNow(-40),  // started 40 days ago
      endDate: daysFromNow(3),      // ends in 3 days
      paymentCycle: "MONTHLY",
      rentAmount: 5000,
      depositAmount: 10000,
      isAutoRenew: true,
      gracePeriodDays: 3,
      autoRenewalNoticeDays: 10,    // deadline = endDate - 10 = 7 days ago
      status: "ACTIVE",
      paidAt: daysFromNow(-40),
      paymentMethod: "CASH",
      paymentStatus: "COMPLETED",
    },
  })
  // Create renewal DRAFT so cron skips this lease (renewedTo != null)
  await prisma.leaseAgreement.create({
    data: {
      tenantId: johnDoe.id,
      unitId: penthouseA.id,
      organizationId: org.id,
      startDate: daysFromNow(4),    // starts day after case 3 ends
      endDate: daysFromNow(34),     // ~1 month
      paymentCycle: "MONTHLY",
      rentAmount: 5000,
      depositAmount: 10000,
      isAutoRenew: true,
      gracePeriodDays: 3,
      autoRenewalNoticeDays: 10,
      status: "DRAFT",
      renewedFromId: case3Lease.id,
    },
  })
  console.log("✓ Created lease: ACTIVE, auto-renewal ON, notice PASSED + renewal DRAFT (John Doe / Penthouse A)")

  // Test: "Edit Deposit Status" button visible — lease is ENDED, has deposit, and no renewal
  // --- Case 4: ENDED lease — deposit HELD, NOT renewed ---
  await prisma.leaseAgreement.create({
    data: {
      tenantId: johnDoe.id,
      unitId: unit101.id,
      organizationId: org.id,
      startDate: daysFromNow(-90),  // started 90 days ago
      endDate: daysFromNow(-60),    // ended 60 days ago
      paymentCycle: "MONTHLY",
      rentAmount: 1500,
      depositAmount: 3000,
      depositStatus: "HELD",
      status: "ENDED",
      paidAt: daysFromNow(-90),
      paymentMethod: "CASH",
      paymentStatus: "COMPLETED",
    },
  })
  console.log("✓ Created lease: ENDED, deposit HELD, no renewal (John Doe / Unit 101)")

  // Test: "Edit Deposit Status" button NOT visible — lease is ENDED but has a renewedTo link
  // Lease B (renewed ACTIVE) shows the renewal chain on its detail page
  // --- Case 5: ENDED lease + renewal chain ---
  const leaseA = await prisma.leaseAgreement.create({
    data: {
      tenantId: janeSmith.id,
      unitId: unit102.id,
      organizationId: org.id,
      startDate: daysFromNow(-60),   // started 60 days ago
      endDate: daysFromNow(-1),      // ended yesterday
      paymentCycle: "MONTHLY",
      rentAmount: 1600,
      depositAmount: 3200,
      isAutoRenew: true,
      gracePeriodDays: 3,
      autoRenewalNoticeDays: 5,
      status: "ENDED",
      paidAt: daysFromNow(-60),
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "COMPLETED",
    },
  })
  await prisma.leaseAgreement.create({
    data: {
      tenantId: janeSmith.id,
      unitId: unit102.id,
      organizationId: org.id,
      startDate: daysFromNow(0),     // starts today
      endDate: daysFromNow(30),      // ends in 30 days
      paymentCycle: "MONTHLY",
      rentAmount: 1600,
      depositAmount: 3200,
      isAutoRenew: true,
      gracePeriodDays: 3,
      autoRenewalNoticeDays: 5,
      status: "ACTIVE",
      paidAt: daysFromNow(0),
      paymentMethod: "BANK_TRANSFER",
      paymentStatus: "COMPLETED",
      renewedFromId: leaseA.id,
    },
  })
  console.log("✓ Created lease: ENDED + ACTIVE renewal chain (Jane Smith / Unit 102)")

  // Test: auto-renewal toggle DISABLED — can't enable because Bob Wilson has a DRAFT lease
  // on the same unit (Villa 1) starting after this lease ends
  // --- Case 6: ACTIVE lease with future lease blocking auto-renewal ---
  await prisma.leaseAgreement.create({
    data: {
      tenantId: janeSmith.id,
      unitId: villa1.id,
      organizationId: org.id,
      startDate: daysFromNow(-10),   // started 10 days ago
      endDate: daysFromNow(20),      // ends in 20 days
      paymentCycle: "MONTHLY",
      rentAmount: 3500,
      isAutoRenew: false,
      status: "ACTIVE",
      paidAt: daysFromNow(-10),
      paymentMethod: "CASH",
      paymentStatus: "COMPLETED",
    },
  })
  await prisma.leaseAgreement.create({
    data: {
      tenantId: bobWilson.id,
      unitId: villa1.id,
      organizationId: org.id,
      startDate: daysFromNow(35),    // starts 35 days from now (after case 6a ends)
      endDate: daysFromNow(65),      // ends 65 days from now
      paymentCycle: "MONTHLY",
      rentAmount: 3500,
      status: "DRAFT",
    },
  })
  console.log("✓ Created lease: ACTIVE + future DRAFT on same unit (Villa 1)")

  // Update tenant statuses to match lease states
  await prisma.tenant.update({ where: { id: johnDoe.id }, data: { status: "ACTIVE" } })
  await prisma.tenant.update({ where: { id: janeSmith.id }, data: { status: "ACTIVE" } })
  await prisma.tenant.update({ where: { id: bobWilson.id }, data: { status: "ACTIVE" } })
  console.log("✓ Updated tenant statuses")

  console.log("✓ Linked features to tiers")

  console.log("🎉 Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
