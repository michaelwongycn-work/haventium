/**
 * Development seed — example data for local dev only.
 * Never run this in production.
 *
 * Usage: pnpm db:seed:dev
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { seedConstants } from "./seed.js";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type LeaseData = Prisma.LeaseAgreementCreateManyInput;

// ─── Date helpers ────────────────────────────────────────────────────────────

const createDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

async function main() {
  console.log("🌱 Starting dev seed...");

  // ─── Run constants first ────────────────────────────────────────────────
  console.log("\n📦 Seeding constants...");
  const { proTier, accesses } = await seedConstants(prisma);

  // ─── Cleanup example data ───────────────────────────────────────────────
  console.log("\n🧹 Cleaning up existing example data...");
  await prisma.notificationLog.deleteMany({});
  await prisma.notificationRule.deleteMany({});
  await prisma.notificationTemplate.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.paymentTransaction.deleteMany({});
  await prisma.maintenanceRequest.deleteMany({});
  await prisma.leaseAgreement.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.property.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.roleAccess.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.apiKey.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});
  console.log("✓ Cleanup finished");

  // ─── Organization ────────────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      id: "test-org-id",
      name: "Haventium Test Org",
    },
  });
  console.log("✓ Created Test Organization");

  // ─── Subscription ────────────────────────────────────────────────────────
  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      tierId: proTier.id,
      status: "ACTIVE",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("✓ Created PRO Subscription for Test Org");

  // ─── Roles ───────────────────────────────────────────────────────────────
  const ownerRole = await prisma.role.create({
    data: { name: "Owner", isSystem: true, organizationId: org.id },
  });

  for (const access of accesses) {
    await prisma.roleAccess.create({
      data: { roleId: ownerRole.id, accessId: access.id },
    });
  }
  console.log("✓ Created Owner Role");

  const propertyManagerRole = await prisma.role.create({
    data: { name: "Property Manager", isSystem: false, organizationId: org.id },
  });
  const propertyManagerResources = [
    "properties",
    "tenants",
    "leases",
    "payments",
    "notifications",
  ];
  for (const access of accesses) {
    if (propertyManagerResources.includes(access.resource)) {
      await prisma.roleAccess.create({
        data: { roleId: propertyManagerRole.id, accessId: access.id },
      });
    }
  }
  console.log("✓ Created Property Manager Role");

  const notificationManagerRole = await prisma.role.create({
    data: {
      name: "Notification Manager",
      isSystem: false,
      organizationId: org.id,
    },
  });
  for (const access of accesses) {
    if (access.resource === "notifications") {
      await prisma.roleAccess.create({
        data: { roleId: notificationManagerRole.id, accessId: access.id },
      });
    }
  }
  console.log("✓ Created Notification Manager Role");

  const maintenanceStaffRole = await prisma.role.create({
    data: {
      name: "Maintenance Staff",
      isSystem: false,
      organizationId: org.id,
    },
  });
  for (const access of accesses) {
    if (["maintenance", "properties"].includes(access.resource)) {
      await prisma.roleAccess.create({
        data: { roleId: maintenanceStaffRole.id, accessId: access.id },
      });
    }
  }
  console.log("✓ Created Maintenance Staff Role");

  const viewerRole = await prisma.role.create({
    data: { name: "Viewer", isSystem: false, organizationId: org.id },
  });
  for (const access of accesses) {
    if (access.action === "read") {
      await prisma.roleAccess.create({
        data: { roleId: viewerRole.id, accessId: access.id },
      });
    }
  }
  console.log("✓ Created Viewer Role");

  // ─── Users ───────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash("Password1!", 10);

  const testUser = await prisma.user.create({
    data: {
      email: "test@test.com",
      name: "Test User",
      hashedPassword,
      organizationId: org.id,
      emailVerified: new Date(),
    },
  });
  await prisma.userRole.create({
    data: { userId: testUser.id, roleId: ownerRole.id },
  });
  console.log("✓ Created test@test.com (Owner)");

  const testUsers = [];

  for (let i = 1; i <= 3; i++) {
    const user = await prisma.user.create({
      data: {
        email: `manager${i}@test.com`,
        name: `Property Manager ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: propertyManagerRole.id },
    });
    testUsers.push(user);
  }

  for (let i = 1; i <= 2; i++) {
    const user = await prisma.user.create({
      data: {
        email: `notifier${i}@test.com`,
        name: `Notification Manager ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: notificationManagerRole.id },
    });
    testUsers.push(user);
  }

  for (let i = 1; i <= 4; i++) {
    const user = await prisma.user.create({
      data: {
        email: `maintenance${i}@test.com`,
        name: `Maintenance Staff ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: maintenanceStaffRole.id },
    });
    testUsers.push(user);
  }

  for (let i = 1; i <= 2; i++) {
    const user = await prisma.user.create({
      data: {
        email: `viewer${i}@test.com`,
        name: `Viewer ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: viewerRole.id },
    });
    testUsers.push(user);
  }

  console.log(`✓ Created ${testUsers.length} additional test users`);

  // ─── API Keys ─────────────────────────────────────────────────────────────
  const { encrypt, getLastFourChars } = await import("../src/lib/encryption.js");

  const testMailerSendKey =
    process.env.MAILERSEND_API_KEY || "mlsn.test_key_12345678";
  const mailerSendEncrypted = encrypt(testMailerSendKey);
  await prisma.apiKey.create({
    data: {
      organizationId: org.id,
      name: "MailerSend Production",
      service: "MAILERSEND_EMAIL",
      encryptedValue: mailerSendEncrypted.encrypted,
      encryptionIv: mailerSendEncrypted.iv,
      encryptionTag: mailerSendEncrypted.tag,
      lastFourChars: getLastFourChars(testMailerSendKey),
      isActive: true,
    },
  });

  const testWhatsAppCreds = JSON.stringify({
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "test_access_token",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "123456789",
    businessAccountId:
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "987654321",
  });
  const whatsappEncrypted = encrypt(testWhatsAppCreds);
  await prisma.apiKey.create({
    data: {
      organizationId: org.id,
      name: "WhatsApp Business",
      service: "WHATSAPP_META",
      encryptedValue: whatsappEncrypted.encrypted,
      encryptionIv: whatsappEncrypted.iv,
      encryptionTag: whatsappEncrypted.tag,
      lastFourChars: getLastFourChars(testWhatsAppCreds),
      isActive: true,
    },
  });

  console.log("✓ Created API keys");

  // ─── Properties & Units ──────────────────────────────────────────────────
  console.log("\n🏢 Creating properties and units...");

  const propertyConfigs = [
    { name: "Grand View Apartments", unitCount: 25, basePrice: 1200, priceVariance: 800 },
    { name: "Sunset Villas", unitCount: 15, basePrice: 2500, priceVariance: 1500 },
    { name: "Downtown Residences", unitCount: 20, basePrice: 1800, priceVariance: 1200 },
    { name: "Lakeside Towers", unitCount: 18, basePrice: 2200, priceVariance: 1000 },
    { name: "Parkview Condos", unitCount: 5, basePrice: 3000, priceVariance: 2000 },
  ];

  const properties = [];
  const allUnits = [];

  for (const config of propertyConfigs) {
    const units = [];
    for (let i = 1; i <= config.unitCount; i++) {
      const floor = Math.floor((i - 1) / 5) + 1;
      const unitNum = ((i - 1) % 5) + 1;
      const floorMultiplier = 1 + (floor - 1) * 0.05;
      const randomVariance = Math.random() * config.priceVariance;
      const monthlyRate = Math.round(
        (config.basePrice + randomVariance) * floorMultiplier,
      );
      const annualRate = Math.round(monthlyRate * 11.5);
      const dailyRate = Math.round(monthlyRate / 25);

      units.push({
        name: `Unit ${floor}${unitNum.toString().padStart(2, "0")}`,
        dailyRate,
        monthlyRate,
        annualRate,
        isUnavailable: false,
      });
    }

    const property = await prisma.property.create({
      data: {
        name: config.name,
        organizationId: org.id,
        units: { create: units },
      },
      include: { units: true },
    });

    properties.push(property);
    allUnits.push(...property.units);
  }

  console.log(
    `✓ Created ${properties.length} properties with ${allUnits.length} total units`,
  );

  // ─── Tenants ─────────────────────────────────────────────────────────────
  console.log("👥 Creating 500 tenants...");

  const firstNames = [
    "James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda",
    "William","Barbara","David","Elizabeth","Richard","Susan","Joseph","Jessica",
    "Thomas","Sarah","Charles","Karen","Christopher","Nancy","Daniel","Lisa",
    "Matthew","Betty","Anthony","Margaret","Mark","Sandra","Donald","Ashley",
    "Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle",
    "Kenneth","Dorothy","Kevin","Carol","Brian","Amanda","George","Melissa",
    "Edward","Deborah","Ronald","Stephanie","Timothy","Rebecca","Jason","Sharon",
    "Jeffrey","Laura","Ryan","Cynthia","Jacob","Kathleen","Gary","Amy",
    "Nicholas","Shirley","Eric","Angela","Jonathan","Helen","Stephen","Anna",
    "Larry","Brenda","Justin","Pamela","Scott","Nicole","Brandon","Emma",
    "Benjamin","Samantha","Samuel","Katherine","Raymond","Christine","Gregory",
    "Debra","Frank","Rachel","Alexander","Catherine","Patrick","Carolyn","Jack",
    "Janet","Dennis","Ruth","Jerry","Maria","Tyler","Heather","Aaron","Diane",
  ];

  const lastNames = [
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis",
    "Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson",
    "Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson",
    "White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker",
    "Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
    "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell",
    "Carter","Roberts","Gomez","Phillips","Evans","Turner","Diaz","Parker",
    "Cruz","Edwards","Collins","Reyes","Stewart","Morris","Morales","Murphy",
    "Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper","Peterson","Bailey",
    "Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson","Watson",
    "Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz",
    "Hughes","Price","Alvarez","Castillo","Sanders","Patel","Myers","Long",
    "Ross","Foster","Jimenez",
  ];

  const tenants = [];
  for (let i = 0; i < 500; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const phone = `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;

    const rand = Math.random();
    let status: "LEAD" | "BOOKED" | "ACTIVE" | "EXPIRED";
    if (rand < 0.4) status = "ACTIVE";
    else if (rand < 0.7) status = "EXPIRED";
    else if (rand < 0.9) status = "LEAD";
    else status = "BOOKED";

    const tenant = await prisma.tenant.create({
      data: {
        fullName: `${firstName} ${lastName}`,
        email,
        phone,
        status,
        organizationId: org.id,
        preferEmail: Math.random() > 0.2,
        preferWhatsapp: Math.random() > 0.7,
        preferTelegram: Math.random() > 0.9,
      },
    });
    tenants.push(tenant);
  }
  console.log(`✓ Created ${tenants.length} tenants`);

  // ─── Leases ───────────────────────────────────────────────────────────────
  console.log("\n📋 Creating leases spanning 2024-2026...");

  const paymentMethods: Array<"CASH" | "BANK_TRANSFER" | "VIRTUAL_ACCOUNT" | "QRIS"> =
    ["CASH", "BANK_TRANSFER", "VIRTUAL_ACCOUNT", "QRIS"];

  const paymentCycles: Array<"DAILY" | "MONTHLY" | "ANNUAL"> = [
    "MONTHLY","MONTHLY","MONTHLY","MONTHLY","MONTHLY","MONTHLY","ANNUAL","ANNUAL","DAILY",
  ];

  const unitOccupancy: Map<string, Array<{ start: Date; end: Date }>> = new Map();

  const isUnitAvailable = (unitId: string, startDate: Date, endDate: Date) => {
    const occupancies = unitOccupancy.get(unitId) || [];
    return !occupancies.some((p) => startDate <= p.end && endDate >= p.start);
  };

  const markUnitOccupied = (unitId: string, startDate: Date, endDate: Date) => {
    if (!unitOccupancy.has(unitId)) unitOccupancy.set(unitId, []);
    unitOccupancy.get(unitId)!.push({ start: startDate, end: endDate });
  };

  const today = new Date();
  const twoMonthsFromNow = addMonths(today, 2);

  let leaseCount = 0;
  const activeTenants = tenants.filter((t) => t.status === "ACTIVE");
  const expiredTenants = tenants.filter((t) => t.status === "EXPIRED");
  const bookedTenants = tenants.filter((t) => t.status === "BOOKED");
  const leadTenants = tenants.filter((t) => t.status === "LEAD");

  // Historical (ENDED) leases
  console.log("  Creating historical leases...");
  const historicalLeases: LeaseData[] = [];

  for (const unit of allUnits) {
    const tenant = expiredTenants[Math.floor(Math.random() * expiredTenants.length)];
    const paymentCycle = paymentCycles[Math.floor(Math.random() * paymentCycles.length)];
    const numHistoricalLeases = Math.floor(Math.random() * 6) + 3;
    let currentStartDate = createDate(2024, 1, Math.floor(Math.random() * 28) + 1);

    for (let i = 0; i < numHistoricalLeases; i++) {
      let endDate: Date;
      if (paymentCycle === "DAILY") {
        endDate = addDays(currentStartDate, 1);
      } else if (paymentCycle === "MONTHLY") {
        endDate = addDays(addMonths(currentStartDate, 1), -1);
      } else {
        endDate = addDays(addMonths(currentStartDate, 12), -1);
      }

      if (endDate >= today) break;

      const rentAmount = Number(
        paymentCycle === "ANNUAL"
          ? unit.annualRate
          : paymentCycle === "MONTHLY"
            ? unit.monthlyRate
            : unit.dailyRate,
      );
      const depositAmount =
        i === 0 ? Math.round(rentAmount * (Math.random() * 0.5 + 1)) : null;

      historicalLeases.push({
        tenantId: tenant.id,
        unitId: unit.id,
        organizationId: org.id,
        startDate: currentStartDate,
        endDate,
        paymentCycle,
        rentAmount,
        depositAmount,
        depositStatus: depositAmount
          ? Math.random() > 0.3
            ? "RETURNED"
            : "HELD"
          : null,
        status: "ENDED",
        paidAt: currentStartDate,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        paymentStatus: "COMPLETED",
        isAutoRenew: false,
      });

      markUnitOccupied(unit.id, currentStartDate, endDate);

      currentStartDate =
        paymentCycle === "DAILY"
          ? addDays(endDate, Math.floor(Math.random() * 5) + 3)
          : addDays(endDate, Math.floor(Math.random() * 3) + 1);
    }
  }

  await prisma.leaseAgreement.createMany({ data: historicalLeases });
  leaseCount += historicalLeases.length;
  console.log(`  ✓ Created ${historicalLeases.length} historical leases`);

  // Active leases (70% of units)
  console.log("  Creating active leases...");
  const activeLeases: LeaseData[] = [];
  const unitsForActiveLease = allUnits
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(allUnits.length * 0.7));

  for (const unit of unitsForActiveLease) {
    const tenant = activeTenants[leaseCount % activeTenants.length];
    const paymentCycle = paymentCycles[leaseCount % paymentCycles.length];
    const occupancies = unitOccupancy.get(unit.id) || [];

    let currentStartDate: Date;
    if (occupancies.length > 0) {
      currentStartDate = addDays(occupancies[occupancies.length - 1].end, 1);
    } else {
      currentStartDate = addMonths(today, -(Math.floor(Math.random() * 6) + 1));
    }

    let endDate: Date;
    if (paymentCycle === "DAILY") {
      endDate = addDays(currentStartDate, 1);
    } else if (paymentCycle === "MONTHLY") {
      endDate = addDays(addMonths(currentStartDate, 1), -1);
    } else {
      endDate = addDays(addMonths(currentStartDate, 12), -1);
    }

    while (endDate < today) {
      currentStartDate = addDays(endDate, 1);
      if (paymentCycle === "DAILY") endDate = addDays(currentStartDate, 1);
      else if (paymentCycle === "MONTHLY")
        endDate = addDays(addMonths(currentStartDate, 1), -1);
      else endDate = addDays(addMonths(currentStartDate, 12), -1);
    }

    if (endDate > twoMonthsFromNow) endDate = twoMonthsFromNow;

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const isAutoRenew = Math.random() > 0.6;

    activeLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate: currentStartDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount: Math.round(rentAmount * (Math.random() * 0.5 + 1)),
      depositStatus: "HELD",
      status: "ACTIVE",
      paidAt: currentStartDate,
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      paymentStatus: "COMPLETED",
      isAutoRenew,
      gracePeriodDays: isAutoRenew ? Math.floor(Math.random() * 5) + 3 : null,
      autoRenewalNoticeDays: isAutoRenew ? Math.floor(Math.random() * 20) + 10 : null,
    });

    markUnitOccupied(unit.id, currentStartDate, endDate);
    leaseCount++;
  }

  await prisma.leaseAgreement.createMany({ data: activeLeases });
  console.log(`  ✓ Created ${activeLeases.length} active leases`);

  // Draft leases for remaining units
  console.log("  Creating draft leases...");
  const draftLeases: LeaseData[] = [];
  const unitsWithoutActive = allUnits.filter(
    (unit) => !unitsForActiveLease.includes(unit),
  );

  for (const unit of unitsWithoutActive) {
    const tenant =
      leaseCount < bookedTenants.length
        ? bookedTenants[leaseCount % bookedTenants.length]
        : leadTenants[leaseCount % leadTenants.length];

    const occupancies = unitOccupancy.get(unit.id) || [];
    let startDate: Date;
    if (occupancies.length > 0) {
      startDate = addDays(
        occupancies[occupancies.length - 1].end,
        Math.floor(Math.random() * 7) + 1,
      );
    } else {
      startDate = addDays(today, Math.floor(Math.random() * 60));
    }

    if (startDate > twoMonthsFromNow) {
      startDate = addDays(today, Math.floor(Math.random() * 60));
    }

    const paymentCycle = paymentCycles[leaseCount % paymentCycles.length];
    let endDate: Date;
    if (paymentCycle === "DAILY") endDate = addDays(startDate, 1);
    else if (paymentCycle === "MONTHLY")
      endDate = addDays(addMonths(startDate, 1), -1);
    else endDate = addDays(addMonths(startDate, 12), -1);

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const hasGracePeriod = Math.random() > 0.5;

    draftLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount: Math.round(rentAmount * (Math.random() * 0.5 + 1)),
      status: "DRAFT",
      paidAt: null,
      paymentMethod: null,
      paymentStatus: "PENDING",
      gracePeriodDays: hasGracePeriod ? Math.floor(Math.random() * 7) + 3 : null,
    });

    markUnitOccupied(unit.id, startDate, endDate);
    leaseCount++;
  }

  await prisma.leaseAgreement.createMany({ data: draftLeases });
  console.log(`  ✓ Created ${draftLeases.length} draft leases`);

  // Additional draft leases (future bookings for 40% of active units)
  const additionalDraftLeases: LeaseData[] = [];
  const unitsForAdditionalDraft = unitsForActiveLease
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(unitsForActiveLease.length * 0.4));

  for (const unit of unitsForAdditionalDraft) {
    const tenant =
      leaseCount < bookedTenants.length
        ? bookedTenants[leaseCount % bookedTenants.length]
        : leadTenants[leaseCount % leadTenants.length];

    const occupancies = unitOccupancy.get(unit.id) || [];
    let startDate: Date;
    if (occupancies.length > 0) {
      startDate = addDays(
        occupancies[occupancies.length - 1].end,
        Math.floor(Math.random() * 3) + 1,
      );
    } else {
      startDate = addDays(today, Math.floor(Math.random() * 60));
    }

    const paymentCycle = paymentCycles[leaseCount % paymentCycles.length];
    let endDate: Date;
    if (paymentCycle === "DAILY") endDate = addDays(startDate, 1);
    else if (paymentCycle === "MONTHLY")
      endDate = addDays(addMonths(startDate, 1), -1);
    else endDate = addDays(addMonths(startDate, 12), -1);

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const hasGracePeriod = Math.random() > 0.4;

    additionalDraftLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount: Math.round(rentAmount * (Math.random() * 0.5 + 1)),
      status: "DRAFT",
      paidAt: null,
      paymentMethod: null,
      paymentStatus: "PENDING",
      gracePeriodDays: hasGracePeriod ? Math.floor(Math.random() * 7) + 3 : null,
    });

    markUnitOccupied(unit.id, startDate, endDate);
    leaseCount++;
  }

  await prisma.leaseAgreement.createMany({ data: additionalDraftLeases });
  console.log(`  ✓ Created ${additionalDraftLeases.length} additional draft leases`);

  // Spread draft leases (including overdue)
  const spreadDraftLeases: LeaseData[] = [];
  for (let i = 0; i < 30; i++) {
    const unit = allUnits[Math.floor(Math.random() * allUnits.length)];
    const tenant =
      Math.random() > 0.5
        ? bookedTenants[Math.floor(Math.random() * bookedTenants.length)]
        : leadTenants[Math.floor(Math.random() * leadTenants.length)];

    const daysOffset = Math.floor(Math.random() * 75) - 15;
    const startDate = addDays(today, daysOffset);
    const paymentCycle = paymentCycles[Math.floor(Math.random() * paymentCycles.length)];

    let endDate: Date;
    if (paymentCycle === "DAILY") endDate = addDays(startDate, 1);
    else if (paymentCycle === "MONTHLY")
      endDate = addDays(addMonths(startDate, 1), -1);
    else endDate = addDays(addMonths(startDate, 12), -1);

    if (!isUnitAvailable(unit.id, startDate, endDate)) continue;

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const hasGracePeriod = Math.random() > 0.3;

    spreadDraftLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount: Math.round(rentAmount * (Math.random() * 0.5 + 1)),
      status: "DRAFT",
      paidAt: null,
      paymentMethod: null,
      paymentStatus: "PENDING",
      gracePeriodDays: hasGracePeriod ? Math.floor(Math.random() * 7) + 3 : null,
    });

    markUnitOccupied(unit.id, startDate, endDate);
  }

  await prisma.leaseAgreement.createMany({ data: spreadDraftLeases });
  console.log(`  ✓ Created ${spreadDraftLeases.length} spread draft leases (including overdue)`);

  // Cancelled leases
  const cancelledLeases: LeaseData[] = [];
  for (let i = 0; i < 50; i++) {
    const unit = allUnits[Math.floor(Math.random() * allUnits.length)];
    const tenant = tenants[Math.floor(Math.random() * tenants.length)];
    const startYear = Math.random() > 0.5 ? 2024 : 2025;
    const startDate = createDate(
      startYear,
      Math.floor(Math.random() * 12) + 1,
      Math.floor(Math.random() * 28) + 1,
    );
    const finalEndDate = addDays(addMonths(startDate, 1), -1);

    if (!isUnitAvailable(unit.id, startDate, finalEndDate)) continue;

    cancelledLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate,
      endDate: finalEndDate,
      paymentCycle: "MONTHLY",
      rentAmount: Number(unit.monthlyRate),
      status: "CANCELLED",
    });

    leaseCount++;
  }

  await prisma.leaseAgreement.createMany({ data: cancelledLeases });
  console.log(`  ✓ Created ${cancelledLeases.length} cancelled leases`);
  console.log(`\n✓ Created ${leaseCount} total leases`);

  // ─── Maintenance Requests ────────────────────────────────────────────────
  console.log("\n🔧 Creating maintenance requests...");

  const allLeases = await prisma.leaseAgreement.findMany({
    include: { unit: { include: { property: true } }, tenant: true },
  });

  const maintenanceIssues = [
    { title: "Leaking Faucet", description: "Kitchen faucet drips constantly even when closed.", priority: "MEDIUM" as const, estimatedCost: 150 },
    { title: "Broken Window", description: "Bedroom window won't close properly.", priority: "HIGH" as const, estimatedCost: 300 },
    { title: "AC Not Cooling", description: "Air conditioning unit runs but doesn't cool the room.", priority: "URGENT" as const, estimatedCost: 500 },
    { title: "Clogged Drain", description: "Bathroom sink drains very slowly.", priority: "MEDIUM" as const, estimatedCost: 100 },
    { title: "Light Fixture Out", description: "Ceiling light in living room not working.", priority: "LOW" as const, estimatedCost: 50 },
    { title: "Door Lock Stuck", description: "Front door lock is difficult to turn.", priority: "HIGH" as const, estimatedCost: 200 },
    { title: "Water Heater Issue", description: "Hot water runs out very quickly.", priority: "HIGH" as const, estimatedCost: 400 },
    { title: "Pest Problem", description: "Noticed cockroaches in the kitchen area.", priority: "URGENT" as const, estimatedCost: 250 },
    { title: "Refrigerator Not Cold", description: "Refrigerator not maintaining temperature.", priority: "URGENT" as const, estimatedCost: 350 },
    { title: "Toilet Running", description: "Toilet keeps running after flush.", priority: "MEDIUM" as const, estimatedCost: 120 },
    { title: "Paint Peeling", description: "Paint peeling off walls in multiple rooms.", priority: "LOW" as const, estimatedCost: 300 },
    { title: "Garbage Disposal Jammed", description: "Kitchen garbage disposal won't turn on.", priority: "MEDIUM" as const, estimatedCost: 180 },
    { title: "Smoke Detector Beeping", description: "Smoke detector beeps intermittently.", priority: "HIGH" as const, estimatedCost: 75 },
    { title: "Heating Not Working", description: "Heater doesn't turn on at all.", priority: "URGENT" as const, estimatedCost: 450 },
    { title: "Carpet Stain", description: "Large stain on living room carpet needs cleaning.", priority: "LOW" as const, estimatedCost: 150 },
  ];

  let maintenanceCount = 0;

  for (const lease of allLeases.filter((l) => l.status === "ENDED")) {
    if (Math.random() > 0.4) {
      const issueCount = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < issueCount; i++) {
        const issue = maintenanceIssues[Math.floor(Math.random() * maintenanceIssues.length)];
        const status = Math.random() > 0.2 ? "COMPLETED" : (["OPEN","IN_PROGRESS","COMPLETED","CANCELLED"] as const)[Math.floor(Math.random() * 4)];
        const createdDate = new Date(
          lease.startDate.getTime() +
            Math.random() * (lease.endDate.getTime() - lease.startDate.getTime()),
        );
        const actualCost = status === "COMPLETED" ? Math.round(issue.estimatedCost * (0.8 + Math.random() * 0.4)) : null;
        const completedAt = status === "COMPLETED" ? new Date(createdDate.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000) : null;

        await prisma.maintenanceRequest.create({
          data: {
            organizationId: org.id,
            propertyId: lease.unit.propertyId,
            unitId: lease.unitId,
            tenantId: lease.tenantId,
            leaseId: lease.id,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            status,
            estimatedCost: issue.estimatedCost,
            actualCost,
            completedAt,
            createdAt: createdDate,
            updatedAt: completedAt || createdDate,
          },
        });
        maintenanceCount++;
      }
    }
  }

  for (const lease of allLeases.filter((l) => l.status === "ACTIVE")) {
    if (Math.random() > 0.6) {
      const issueCount = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < issueCount; i++) {
        const issue = maintenanceIssues[Math.floor(Math.random() * maintenanceIssues.length)];
        const statusRand = Math.random();
        const status =
          statusRand > 0.7 ? "COMPLETED" :
          statusRand > 0.4 ? "IN_PROGRESS" :
          statusRand > 0.1 ? "OPEN" : "CANCELLED";

        const daysSinceStart = Math.floor(
          (Date.now() - lease.startDate.getTime()) / (24 * 60 * 60 * 1000),
        );
        const createdDate = new Date(
          lease.startDate.getTime() + Math.random() * daysSinceStart * 24 * 60 * 60 * 1000,
        );
        const actualCost = status === "COMPLETED" ? Math.round(issue.estimatedCost * (0.8 + Math.random() * 0.4)) : null;
        const completedAt = status === "COMPLETED" ? new Date(createdDate.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000) : null;

        await prisma.maintenanceRequest.create({
          data: {
            organizationId: org.id,
            propertyId: lease.unit.propertyId,
            unitId: lease.unitId,
            tenantId: lease.tenantId,
            leaseId: lease.id,
            title: issue.title,
            description: issue.description,
            priority: issue.priority,
            status,
            estimatedCost: issue.estimatedCost,
            actualCost,
            completedAt,
            createdAt: createdDate,
            updatedAt: completedAt || createdDate,
          },
        });
        maintenanceCount++;
      }
    }
  }

  // Sample explicit maintenance requests
  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: properties[0].id,
      unitId: allUnits[0].id,
      tenantId: activeTenants[0].id,
      title: "Leaking Faucet in Kitchen",
      description: "The kitchen faucet has been leaking for the past few days.",
      status: "OPEN",
      priority: "MEDIUM",
      estimatedCost: 150,
    },
  });

  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: properties[1].id,
      unitId: allUnits[5].id,
      tenantId: activeTenants[1].id,
      title: "Air Conditioning Not Working",
      description: "The AC unit stopped working completely.",
      status: "IN_PROGRESS",
      priority: "URGENT",
      estimatedCost: 500,
      actualCost: 450,
    },
  });

  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: properties[2].id,
      unitId: allUnits[10].id,
      tenantId: activeTenants[2].id,
      title: "Replace Air Filter",
      description: "Routine air filter replacement for HVAC system.",
      status: "COMPLETED",
      priority: "LOW",
      estimatedCost: 50,
      actualCost: 45,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: properties[0].id,
      title: "Common Area Light Fixtures",
      description: "Several light fixtures in the hallway need bulb replacements.",
      status: "OPEN",
      priority: "LOW",
    },
  });

  maintenanceCount += 4;
  console.log(`✓ Created ${maintenanceCount} maintenance requests`);

  // ─── Notification Templates & Rules ──────────────────────────────────────
  console.log("\n📧 Creating notification templates and rules...");

  await prisma.notificationTemplate.create({
    data: {
      organizationId: org.id,
      name: "Payment Reminder Email",
      trigger: "PAYMENT_REMINDER",
      channel: "EMAIL",
      subject: "Payment Reminder - {{propertyName}}",
      body: `Dear {{tenantName}},\n\nThis is a friendly reminder that your rent payment is due soon.\n\nProperty: {{propertyName}} - {{unitName}}\nAmount: {{rentAmount}}\nDue Date: {{leaseStartDate}}\n\nThank you,\nHaventium Property Management`,
      isActive: true,
    },
  });

  await prisma.notificationTemplate.create({
    data: {
      organizationId: org.id,
      name: "Lease Expiring Email",
      trigger: "LEASE_EXPIRING",
      channel: "EMAIL",
      subject: "Your Lease is Expiring Soon - {{propertyName}}",
      body: `Dear {{tenantName}},\n\nYour lease agreement is expiring soon.\n\nProperty: {{propertyName}} - {{unitName}}\nLease End Date: {{leaseEndDate}}\n\nThank you,\nHaventium Property Management`,
      isActive: true,
    },
  });

  await prisma.notificationTemplate.create({
    data: {
      organizationId: org.id,
      name: "Payment Confirmed Email",
      trigger: "PAYMENT_CONFIRMED",
      channel: "EMAIL",
      subject: "Payment Received - {{propertyName}}",
      body: `Dear {{tenantName}},\n\nThank you! We have received your payment.\n\nProperty: {{propertyName}} - {{unitName}}\nAmount: {{rentAmount}}\nPayment Date: {{leaseStartDate}}\n\nThank you,\nHaventium Property Management`,
      isActive: true,
    },
  });

  await prisma.notificationRule.create({
    data: {
      organizationId: org.id,
      name: "Payment Reminder 7 Days Before",
      trigger: "PAYMENT_REMINDER",
      daysOffset: -7,
      channels: ["EMAIL"],
      recipientType: "TENANT",
      isActive: true,
    },
  });

  await prisma.notificationRule.create({
    data: {
      organizationId: org.id,
      name: "Lease Expiring 14 Days Before",
      trigger: "LEASE_EXPIRING",
      daysOffset: -14,
      channels: ["EMAIL"],
      recipientType: "TENANT",
      isActive: true,
    },
  });

  await prisma.notificationRule.create({
    data: {
      organizationId: org.id,
      name: "Payment Confirmed Notification",
      trigger: "PAYMENT_CONFIRMED",
      daysOffset: 0,
      channels: ["EMAIL"],
      recipientType: "TENANT",
      isActive: true,
    },
  });

  console.log("✓ Created notification templates and rules");

  // ─── Notification History ────────────────────────────────────────────────
  console.log("📧 Creating notification history...");

  const allLeasesWithRelations = await prisma.leaseAgreement.findMany({
    where: { organizationId: org.id },
    include: { tenant: true, unit: { include: { property: true } } },
  });

  const notificationChannels: Array<"EMAIL" | "WHATSAPP" | "TELEGRAM"> = [
    "EMAIL","WHATSAPP","TELEGRAM",
  ];
  const notificationTriggers: Array<"PAYMENT_REMINDER" | "PAYMENT_LATE" | "PAYMENT_CONFIRMED" | "LEASE_EXPIRING" | "LEASE_EXPIRED" | "MANUAL"> = [
    "PAYMENT_REMINDER","PAYMENT_LATE","PAYMENT_CONFIRMED","LEASE_EXPIRING","LEASE_EXPIRED","MANUAL",
  ];

  let notificationCount = 0;

  for (const lease of allLeasesWithRelations.filter((l) => l.status === "ENDED").slice(0, 100)) {
    const reminderDate = new Date(lease.startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: lease.tenant.email,
        recipientPhone: lease.tenant.phone,
        trigger: "PAYMENT_REMINDER",
        channel: "EMAIL",
        subject: `Payment Reminder - ${lease.unit.property.name}`,
        body: `Dear ${lease.tenant.fullName}, your rent payment of $${lease.rentAmount} is due soon.`,
        status: "SENT",
        sentAt: reminderDate,
        createdAt: reminderDate,
      },
    });
    notificationCount++;

    if (lease.paidAt) {
      await prisma.notificationLog.create({
        data: {
          organizationId: org.id,
          recipientEmail: lease.tenant.email,
          recipientPhone: lease.tenant.phone,
          trigger: "PAYMENT_CONFIRMED",
          channel: "EMAIL",
          subject: `Payment Received - ${lease.unit.property.name}`,
          body: `Thank you ${lease.tenant.fullName}! We have received your payment of $${lease.rentAmount}.`,
          status: "SENT",
          sentAt: lease.paidAt,
          createdAt: lease.paidAt,
        },
      });
      notificationCount++;
    }

    const expiringDate = new Date(lease.endDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: lease.tenant.email,
        recipientPhone: lease.tenant.phone,
        trigger: "LEASE_EXPIRING",
        channel: "EMAIL",
        subject: `Your Lease is Expiring Soon - ${lease.unit.property.name}`,
        body: `Dear ${lease.tenant.fullName}, your lease will expire on ${lease.endDate.toLocaleDateString()}.`,
        status: "SENT",
        sentAt: expiringDate,
        createdAt: expiringDate,
      },
    });
    notificationCount++;

    const expiredDate = new Date(lease.endDate.getTime() + 24 * 60 * 60 * 1000);
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: lease.tenant.email,
        recipientPhone: lease.tenant.phone,
        trigger: "LEASE_EXPIRED",
        channel: "EMAIL",
        subject: `Lease Expired - ${lease.unit.property.name}`,
        body: `Dear ${lease.tenant.fullName}, your lease has expired.`,
        status: "SENT",
        sentAt: expiredDate,
        createdAt: expiredDate,
      },
    });
    notificationCount++;
  }

  const activeLeasesWithRelations = allLeasesWithRelations.filter((l) => l.status === "ACTIVE");

  for (const lease of activeLeasesWithRelations.slice(0, 80)) {
    const reminderDate = new Date(lease.startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: lease.tenant.email,
        recipientPhone: lease.tenant.phone,
        trigger: "PAYMENT_REMINDER",
        channel: lease.tenant.preferWhatsapp ? "WHATSAPP" : "EMAIL",
        subject: lease.tenant.preferWhatsapp ? null : `Payment Reminder - ${lease.unit.property.name}`,
        body: `Dear ${lease.tenant.fullName}, your rent payment of $${lease.rentAmount} is due soon.`,
        status: "SENT",
        sentAt: reminderDate,
        createdAt: reminderDate,
      },
    });
    notificationCount++;

    if (lease.paidAt) {
      await prisma.notificationLog.create({
        data: {
          organizationId: org.id,
          recipientEmail: lease.tenant.email,
          recipientPhone: lease.tenant.phone,
          trigger: "PAYMENT_CONFIRMED",
          channel: "EMAIL",
          subject: `Payment Received - ${lease.unit.property.name}`,
          body: `Thank you ${lease.tenant.fullName}! We have received your payment.`,
          status: "SENT",
          sentAt: lease.paidAt,
          createdAt: lease.paidAt,
        },
      });
      notificationCount++;
    }

    if (Math.random() < 0.05) {
      await prisma.notificationLog.create({
        data: {
          organizationId: org.id,
          recipientEmail: lease.tenant.email,
          recipientPhone: lease.tenant.phone,
          trigger: "PAYMENT_REMINDER",
          channel: "EMAIL",
          subject: `Payment Reminder - ${lease.unit.property.name}`,
          body: `Dear ${lease.tenant.fullName}, your rent payment is due.`,
          status: "FAILED",
          failedReason: "Invalid email address or mailbox full",
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        },
      });
      notificationCount++;
    }
  }

  for (let i = 0; i < 20; i++) {
    const randomLease = activeLeasesWithRelations[Math.floor(Math.random() * activeLeasesWithRelations.length)];
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: randomLease.tenant.email,
        recipientPhone: randomLease.tenant.phone,
        trigger: notificationTriggers[Math.floor(Math.random() * notificationTriggers.length)],
        channel: notificationChannels[Math.floor(Math.random() * notificationChannels.length)],
        subject: `Notification - ${randomLease.unit.property.name}`,
        body: `Dear ${randomLease.tenant.fullName}, this is a test notification.`,
        status: "PENDING",
        createdAt: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000),
      },
    });
    notificationCount++;
  }

  console.log(`✓ Created ${notificationCount} notification logs`);

  // ─── Sample Documents ────────────────────────────────────────────────────
  const sampleTenant = activeTenants[0];
  await prisma.document.create({
    data: {
      organizationId: org.id,
      propertyId: properties[0].id,
      unitId: allUnits[0].id,
      tenantId: sampleTenant.id,
      filename: "lease-agreement-sample.pdf",
      fileType: "application/pdf",
      fileSize: 245678,
      fileUrl: "https://example.com/placeholder/lease-agreement.pdf",
      storageKey: "seed-placeholder-lease-agreement",
    },
  });
  await prisma.document.create({
    data: {
      organizationId: org.id,
      propertyId: properties[0].id,
      tenantId: sampleTenant.id,
      filename: "tenant-id-proof.pdf",
      fileType: "application/pdf",
      fileSize: 189432,
      fileUrl: "https://example.com/placeholder/id-proof.pdf",
      storageKey: "seed-placeholder-id-proof",
    },
  });
  await prisma.document.create({
    data: {
      organizationId: org.id,
      propertyId: properties[1].id,
      filename: "property-insurance.pdf",
      fileType: "application/pdf",
      fileSize: 456789,
      fileUrl: "https://example.com/placeholder/insurance.pdf",
      storageKey: "seed-placeholder-insurance",
    },
  });
  console.log("✓ Created 3 sample documents");

  // ─── Special Tenant: Michael Wong ────────────────────────────────────────
  console.log("\n👤 Creating special tenant Michael Wong...");

  const michaelProperty = properties[0];
  const michaelUnit = michaelProperty.units[0];

  const michaelTenant = await prisma.tenant.create({
    data: {
      fullName: "Michael Wong",
      email: "michaelwongycn@gmail.com",
      phone: "+60123456789",
      organizationId: org.id,
      status: "ACTIVE",
      preferEmail: true,
      preferWhatsapp: false,
      preferTelegram: false,
    },
  });

  const michaelRentAmount = Number(michaelUnit.monthlyRate);
  const michaelDepositAmount = Math.round(michaelRentAmount * 1.5);

  const chainAnchor = addMonths(today, -6);
  const michaelHistStart = new Date(
    chainAnchor.getFullYear(),
    chainAnchor.getMonth(),
    1,
  );
  let chainStart = michaelHistStart;

  const michaelHistLeases: Prisma.LeaseAgreementGetPayload<Record<string, never>>[] = [];
  let prevLeaseId: string | null = null;

  const autoRenewPaymentMethods: Array<"CASH" | "BANK_TRANSFER" | "VIRTUAL_ACCOUNT" | "QRIS"> =
    ["BANK_TRANSFER","BANK_TRANSFER","VIRTUAL_ACCOUNT","QRIS","BANK_TRANSFER"];

  for (let i = 0; i < 5; i++) {
    const chainEnd = new Date(
      chainStart.getFullYear(),
      chainStart.getMonth() + 1,
      0,
    );
    const lease = await prisma.leaseAgreement.create({
      data: {
        tenantId: michaelTenant.id,
        unitId: michaelUnit.id,
        organizationId: org.id,
        startDate: chainStart,
        endDate: chainEnd,
        paymentCycle: "MONTHLY",
        rentAmount: michaelRentAmount,
        depositAmount: michaelDepositAmount,
        depositStatus: "CARRIED",
        status: "ENDED",
        paidAt: chainStart,
        paymentMethod: autoRenewPaymentMethods[i],
        paymentStatus: "COMPLETED",
        isAutoRenew: true,
        autoRenewalNoticeDays: 5,
        gracePeriodDays: 5,
        renewedFromId: prevLeaseId ?? undefined,
      },
    });
    michaelHistLeases.push(lease);
    prevLeaseId = lease.id;
    chainStart = new Date(chainStart.getFullYear(), chainStart.getMonth() + 1, 1);
  }

  console.log("  ✓ Created 5 auto-renewed ENDED leases for Michael");

  const michaelActiveStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const michaelActiveEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const michaelActiveLease = await prisma.leaseAgreement.create({
    data: {
      tenantId: michaelTenant.id,
      unitId: michaelUnit.id,
      organizationId: org.id,
      startDate: michaelActiveStart,
      endDate: michaelActiveEnd,
      paymentCycle: "MONTHLY",
      rentAmount: michaelRentAmount,
      depositAmount: michaelDepositAmount,
      depositStatus: "HELD",
      status: "ACTIVE",
      paidAt: michaelActiveStart,
      paymentMethod: "VIRTUAL_ACCOUNT",
      paymentStatus: "COMPLETED",
      isAutoRenew: true,
      autoRenewalNoticeDays: 5,
      gracePeriodDays: 5,
      renewedFromId: prevLeaseId,
    },
  });
  prevLeaseId = michaelActiveLease.id;

  const michaelFutureStart = new Date(
    michaelActiveStart.getFullYear(),
    michaelActiveStart.getMonth() + 1,
    1,
  );
  const michaelFutureEnd = new Date(
    michaelFutureStart.getFullYear(),
    michaelFutureStart.getMonth() + 1,
    0,
  );
  const michaelFutureLease = await prisma.leaseAgreement.create({
    data: {
      tenantId: michaelTenant.id,
      unitId: michaelUnit.id,
      organizationId: org.id,
      startDate: michaelFutureStart,
      endDate: michaelFutureEnd,
      paymentCycle: "MONTHLY",
      rentAmount: michaelRentAmount,
      depositAmount: michaelDepositAmount,
      depositStatus: "HELD",
      status: "DRAFT",
      paidAt: null,
      paymentMethod: null,
      paymentStatus: "PENDING",
      isAutoRenew: true,
      autoRenewalNoticeDays: 5,
      gracePeriodDays: 5,
      renewedFromId: prevLeaseId,
    },
  });

  console.log("  ✓ Created ACTIVE + DRAFT lease for Michael");

  // Payment transactions for Michael's paid leases
  for (const lease of [...michaelHistLeases, michaelActiveLease]) {
    await prisma.paymentTransaction.create({
      data: {
        organizationId: org.id,
        leaseId: lease.id,
        type: "RENT",
        gateway: "MANUAL",
        externalId: `seed-manual-${lease.id}`,
        amount: michaelRentAmount,
        status: "COMPLETED",
        paidAt: lease.paidAt,
      },
    });
  }
  console.log(`  ✓ Created ${michaelHistLeases.length + 1} payment transactions for Michael`);

  // Michael's maintenance requests
  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: michaelProperty.id,
      unitId: michaelUnit.id,
      tenantId: michaelTenant.id,
      leaseId: michaelHistLeases[0].id,
      title: "Broken Window Latch",
      description: "The latch on the bedroom window is broken and won't lock properly.",
      priority: "HIGH",
      status: "COMPLETED",
      estimatedCost: 200,
      actualCost: 180,
      completedAt: addDays(michaelHistStart, 10),
      createdAt: addDays(michaelHistStart, 5),
      updatedAt: addDays(michaelHistStart, 10),
    },
  });

  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: michaelProperty.id,
      unitId: michaelUnit.id,
      tenantId: michaelTenant.id,
      leaseId: michaelActiveLease.id,
      title: "Leaking Kitchen Faucet",
      description: "Kitchen faucet drips constantly even when fully closed.",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      estimatedCost: 150,
      createdAt: addDays(michaelActiveStart, 3),
      updatedAt: addDays(michaelActiveStart, 3),
    },
  });

  await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: michaelProperty.id,
      unitId: michaelUnit.id,
      tenantId: michaelTenant.id,
      leaseId: michaelFutureLease.id,
      title: "AC Pre-Move-In Inspection",
      description: "Please inspect and service the air conditioning unit before the new lease period begins.",
      priority: "LOW",
      status: "OPEN",
      estimatedCost: 100,
      createdAt: addDays(today, 5),
      updatedAt: addDays(today, 5),
    },
  });

  console.log("  ✓ Created 3 maintenance requests for Michael");

  // Michael's documents
  for (const [lease, filename, storageKey] of [
    [michaelHistLeases[0], "lease-agreement-historical.pdf", "seed-michael-lease-historical"],
    [michaelActiveLease, "lease-agreement-active.pdf", "seed-michael-lease-active"],
    [michaelFutureLease, "lease-agreement-upcoming.pdf", "seed-michael-lease-upcoming"],
  ] as const) {
    await prisma.document.create({
      data: {
        organizationId: org.id,
        propertyId: michaelProperty.id,
        unitId: michaelUnit.id,
        tenantId: michaelTenant.id,
        leaseId: lease.id,
        filename,
        fileType: "application/pdf",
        fileSize: 300000,
        fileUrl: `https://example.com/placeholder/${filename}`,
        storageKey,
        createdAt: lease.startDate,
        updatedAt: lease.startDate,
      },
    });
  }
  await prisma.document.create({
    data: {
      organizationId: org.id,
      propertyId: michaelProperty.id,
      tenantId: michaelTenant.id,
      filename: "michael-id-verification.pdf",
      fileType: "application/pdf",
      fileSize: 145230,
      fileUrl: "https://example.com/placeholder/michael-id.pdf",
      storageKey: "seed-michael-id",
      createdAt: michaelHistStart,
      updatedAt: michaelHistStart,
    },
  });

  console.log("  ✓ Created 4 documents for Michael");
  console.log("✓ Special tenant Michael Wong ready — michaelwongycn@gmail.com");

  console.log("\n🎉 Dev seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Dev seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
