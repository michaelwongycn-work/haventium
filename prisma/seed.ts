import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Use Prisma's generated type for lease creation
type LeaseData = Prisma.LeaseAgreementCreateManyInput;

async function main() {
  console.log("🌱 Starting seed...");

  // Cleanup existing data to avoid duplicates when using .create()
  console.log("🧹 Cleaning up existing data...");
  await prisma.notificationLog.deleteMany({});
  await prisma.notificationRule.deleteMany({});
  await prisma.notificationTemplate.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.maintenanceRequest.deleteMany({});
  await prisma.leaseAgreement.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.unit.deleteMany({});
  await prisma.property.deleteMany({});
  console.log("✓ Cleanup finished");

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
  });
  console.log("✓ Created Free tier");

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
  });
  console.log("✓ Created Normal tier");

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
  });
  console.log("✓ Created Pro tier");

  // Create features
  const emailNotify = await prisma.feature.upsert({
    where: { code: "EMAIL_NOTIFY" },
    update: {},
    create: {
      code: "EMAIL_NOTIFY",
      name: "Email Notifications",
    },
  });

  const whatsappNotify = await prisma.feature.upsert({
    where: { code: "WHATSAPP_NOTIFY" },
    update: {},
    create: {
      code: "WHATSAPP_NOTIFY",
      name: "WhatsApp Notifications",
    },
  });

  const advancedReports = await prisma.feature.upsert({
    where: { code: "ADVANCED_REPORTS" },
    update: {},
    create: {
      code: "ADVANCED_REPORTS",
      name: "Advanced Reports",
    },
  });

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
  });

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
  });

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
  });

  // PRO tier: All features
  const proFeatures = [emailNotify, whatsappNotify, advancedReports];

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
    });
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
    { resource: "notifications", action: "read" },
    { resource: "notifications", action: "create" },
    { resource: "notifications", action: "update" },
    { resource: "notifications", action: "delete" },
    { resource: "maintenance", action: "read" },
    { resource: "maintenance", action: "create" },
    { resource: "maintenance", action: "update" },
    { resource: "maintenance", action: "delete" },
    { resource: "documents", action: "read" },
    { resource: "documents", action: "create" },
    { resource: "documents", action: "delete" },
  ];

  const accesses = [];
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
    });
    accesses.push(access);
  }
  console.log("✓ Created default accesses");

  // Create Test Organization
  const org = await prisma.organization.upsert({
    where: { id: "test-org-id" }, // Using a fixed ID for consistency in local dev
    update: { name: "Haventium Test Org" },
    create: {
      id: "test-org-id",
      name: "Haventium Test Org",
    },
  });
  console.log("✓ Created Test Organization");

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
  });
  console.log("✓ Created PRO Subscription for Test Org");

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
  });

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
    });
  }
  console.log("✓ Created Owner Role and linked all accesses");

  // Create Property Manager Role (has access to properties, tenants, leases, notifications)
  const propertyManagerRole = await prisma.role.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Property Manager",
      },
    },
    update: {},
    create: {
      name: "Property Manager",
      isSystem: false,
      organizationId: org.id,
    },
  });

  // Link property manager accesses (everything except settings/users)
  const propertyManagerResources = [
    "properties",
    "tenants",
    "leases",
    "payments",
    "notifications",
  ];
  for (const access of accesses) {
    if (propertyManagerResources.includes(access.resource)) {
      await prisma.roleAccess.upsert({
        where: {
          roleId_accessId: {
            roleId: propertyManagerRole.id,
            accessId: access.id,
          },
        },
        update: {},
        create: {
          roleId: propertyManagerRole.id,
          accessId: access.id,
        },
      });
    }
  }
  console.log("✓ Created Property Manager Role with operational access");

  // Create Notification Manager Role (only notifications access)
  const notificationManagerRole = await prisma.role.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Notification Manager",
      },
    },
    update: {},
    create: {
      name: "Notification Manager",
      isSystem: false,
      organizationId: org.id,
    },
  });

  // Link notification-related accesses to Notification Manager role
  const notificationAccessResources = ["notifications"];
  for (const access of accesses) {
    if (notificationAccessResources.includes(access.resource)) {
      await prisma.roleAccess.upsert({
        where: {
          roleId_accessId: {
            roleId: notificationManagerRole.id,
            accessId: access.id,
          },
        },
        update: {},
        create: {
          roleId: notificationManagerRole.id,
          accessId: access.id,
        },
      });
    }
  }
  console.log("✓ Created Notification Manager Role with notification access");

  // Create Test User
  const email = "test@test.com";
  const hashedPassword = await bcrypt.hash("Password1!", 10);
  const testUser = await prisma.user.upsert({
    where: { email },
    update: { hashedPassword },
    create: {
      email,
      name: "Test User",
      hashedPassword,
      organizationId: org.id,
    },
  });

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
  });
  console.log(`✓ Created user ${email} and assigned Owner role`);

  // Create API Keys for the organization (for development/testing)
  // Note: In production, users should add their own API keys via the UI
  const { encrypt, getLastFourChars } = await import("../src/lib/encryption");

  // Resend Email API key (use test key for development)
  const testResendKey = process.env.RESEND_API_KEY || "re_test_key_12345678";
  const resendEncrypted = encrypt(testResendKey);

  await prisma.apiKey.upsert({
    where: {
      organizationId_service: {
        organizationId: org.id,
        service: "RESEND_EMAIL",
      },
    },
    update: {
      encryptedValue: resendEncrypted.encrypted,
      encryptionIv: resendEncrypted.iv,
      encryptionTag: resendEncrypted.tag,
      lastFourChars: getLastFourChars(testResendKey),
    },
    create: {
      organizationId: org.id,
      name: "Resend Production",
      service: "RESEND_EMAIL",
      encryptedValue: resendEncrypted.encrypted,
      encryptionIv: resendEncrypted.iv,
      encryptionTag: resendEncrypted.tag,
      lastFourChars: getLastFourChars(testResendKey),
      isActive: true,
    },
  });

  // WhatsApp Meta API credentials (test credentials)
  const testWhatsAppCreds = JSON.stringify({
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "test_access_token",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "123456789",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "987654321",
  });
  const whatsappEncrypted = encrypt(testWhatsAppCreds);

  await prisma.apiKey.upsert({
    where: {
      organizationId_service: {
        organizationId: org.id,
        service: "WHATSAPP_META",
      },
    },
    update: {
      encryptedValue: whatsappEncrypted.encrypted,
      encryptionIv: whatsappEncrypted.iv,
      encryptionTag: whatsappEncrypted.tag,
      lastFourChars: getLastFourChars(testWhatsAppCreds),
    },
    create: {
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

  console.log("✓ Created API keys for Test Organization");

  // ===========================================
  // Create 5 Properties with 5-25 Units Each
  // ===========================================

  console.log("🏢 Creating properties and units...");

  const propertyConfigs = [
    {
      name: "Grand View Apartments",
      unitCount: 25,
      basePrice: 1200,
      priceVariance: 800,
    },
    {
      name: "Sunset Villas",
      unitCount: 15,
      basePrice: 2500,
      priceVariance: 1500,
    },
    {
      name: "Downtown Residences",
      unitCount: 20,
      basePrice: 1800,
      priceVariance: 1200,
    },
    {
      name: "Lakeside Towers",
      unitCount: 18,
      basePrice: 2200,
      priceVariance: 1000,
    },
    {
      name: "Parkview Condos",
      unitCount: 5,
      basePrice: 3000,
      priceVariance: 2000,
    },
  ];

  const properties = [];
  const allUnits = [];

  for (const config of propertyConfigs) {
    const units = [];
    for (let i = 1; i <= config.unitCount; i++) {
      const floor = Math.floor((i - 1) / 5) + 1;
      const unitNum = ((i - 1) % 5) + 1;
      const unitName = `Unit ${floor}${unitNum.toString().padStart(2, "0")}`;

      // Add variance to pricing (higher floors = higher price)
      const floorMultiplier = 1 + (floor - 1) * 0.05;
      const randomVariance = Math.random() * config.priceVariance;
      const monthlyRate = Math.round(
        (config.basePrice + randomVariance) * floorMultiplier,
      );
      const annualRate = Math.round(monthlyRate * 11.5); // Slight discount for annual
      const dailyRate = Math.round(monthlyRate / 25);

      units.push({
        name: unitName,
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
        units: {
          create: units,
        },
      },
      include: { units: true },
    });

    properties.push(property);
    allUnits.push(...property.units);
  }

  console.log(
    `✓ Created ${properties.length} properties with ${allUnits.length} total units`,
  );

  // ===========================================
  // Create 500 Tenants
  // ===========================================

  console.log("👥 Creating 500 tenants...");

  const firstNames = [
    "James",
    "Mary",
    "John",
    "Patricia",
    "Robert",
    "Jennifer",
    "Michael",
    "Linda",
    "William",
    "Barbara",
    "David",
    "Elizabeth",
    "Richard",
    "Susan",
    "Joseph",
    "Jessica",
    "Thomas",
    "Sarah",
    "Charles",
    "Karen",
    "Christopher",
    "Nancy",
    "Daniel",
    "Lisa",
    "Matthew",
    "Betty",
    "Anthony",
    "Margaret",
    "Mark",
    "Sandra",
    "Donald",
    "Ashley",
    "Steven",
    "Kimberly",
    "Paul",
    "Emily",
    "Andrew",
    "Donna",
    "Joshua",
    "Michelle",
    "Kenneth",
    "Dorothy",
    "Kevin",
    "Carol",
    "Brian",
    "Amanda",
    "George",
    "Melissa",
    "Edward",
    "Deborah",
    "Ronald",
    "Stephanie",
    "Timothy",
    "Rebecca",
    "Jason",
    "Sharon",
    "Jeffrey",
    "Laura",
    "Ryan",
    "Cynthia",
    "Jacob",
    "Kathleen",
    "Gary",
    "Amy",
    "Nicholas",
    "Shirley",
    "Eric",
    "Angela",
    "Jonathan",
    "Helen",
    "Stephen",
    "Anna",
    "Larry",
    "Brenda",
    "Justin",
    "Pamela",
    "Scott",
    "Nicole",
    "Brandon",
    "Emma",
    "Benjamin",
    "Samantha",
    "Samuel",
    "Katherine",
    "Raymond",
    "Christine",
    "Gregory",
    "Debra",
    "Frank",
    "Rachel",
    "Alexander",
    "Catherine",
    "Patrick",
    "Carolyn",
    "Jack",
    "Janet",
    "Dennis",
    "Ruth",
    "Jerry",
    "Maria",
    "Tyler",
    "Heather",
    "Aaron",
    "Diane",
  ];

  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Gonzalez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Perez",
    "Thompson",
    "White",
    "Harris",
    "Sanchez",
    "Clark",
    "Ramirez",
    "Lewis",
    "Robinson",
    "Walker",
    "Young",
    "Allen",
    "King",
    "Wright",
    "Scott",
    "Torres",
    "Nguyen",
    "Hill",
    "Flores",
    "Green",
    "Adams",
    "Nelson",
    "Baker",
    "Hall",
    "Rivera",
    "Campbell",
    "Mitchell",
    "Carter",
    "Roberts",
    "Gomez",
    "Phillips",
    "Evans",
    "Turner",
    "Diaz",
    "Parker",
    "Cruz",
    "Edwards",
    "Collins",
    "Reyes",
    "Stewart",
    "Morris",
    "Morales",
    "Murphy",
    "Cook",
    "Rogers",
    "Gutierrez",
    "Ortiz",
    "Morgan",
    "Cooper",
    "Peterson",
    "Bailey",
    "Reed",
    "Kelly",
    "Howard",
    "Ramos",
    "Kim",
    "Cox",
    "Ward",
    "Richardson",
    "Watson",
    "Brooks",
    "Chavez",
    "Wood",
    "James",
    "Bennett",
    "Gray",
    "Mendoza",
    "Ruiz",
    "Hughes",
    "Price",
    "Alvarez",
    "Castillo",
    "Sanders",
    "Patel",
    "Myers",
    "Long",
    "Ross",
    "Foster",
    "Jimenez",
  ];

  const tenants = [];
  const tenantStatuses: Array<"LEAD" | "BOOKED" | "ACTIVE" | "EXPIRED"> = [
    "LEAD",
    "BOOKED",
    "ACTIVE",
    "EXPIRED",
  ];

  for (let i = 0; i < 500; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
    const phone = `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;

    // Weight distribution: 40% ACTIVE, 30% EXPIRED, 20% LEAD, 10% BOOKED
    const rand = Math.random();
    let status: "LEAD" | "BOOKED" | "ACTIVE" | "EXPIRED";
    if (rand < 0.4) status = "ACTIVE";
    else if (rand < 0.7) status = "EXPIRED";
    else if (rand < 0.9) status = "LEAD";
    else status = "BOOKED";

    const tenant = await prisma.tenant.create({
      data: {
        fullName,
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

  // ===========================================
  // Create Leases from 2024 to 2026
  // ===========================================

  console.log("📋 Creating leases spanning 2024-2026...");

  // Helper functions for date manipulation
  const createDate = (year: number, month: number, day: number) => {
    return new Date(year, month - 1, day);
  };

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

  const paymentMethods: Array<
    "CASH" | "BANK_TRANSFER" | "VIRTUAL_ACCOUNT" | "QRIS"
  > = ["CASH", "BANK_TRANSFER", "VIRTUAL_ACCOUNT", "QRIS"];

  // Weight payment cycles to be more realistic (mostly MONTHLY, some ANNUAL, few DAILY)
  const paymentCycles: Array<"DAILY" | "MONTHLY" | "ANNUAL"> = [
    "MONTHLY",
    "MONTHLY",
    "MONTHLY",
    "MONTHLY",
    "MONTHLY",
    "MONTHLY",
    "ANNUAL",
    "ANNUAL",
    "DAILY",
  ];

  // Track which units are occupied during which periods
  const unitOccupancy: Map<
    string,
    Array<{ start: Date; end: Date }>
  > = new Map();

  const isUnitAvailable = (
    unitId: string,
    startDate: Date,
    endDate: Date,
  ): boolean => {
    const occupancies = unitOccupancy.get(unitId) || [];
    for (const period of occupancies) {
      // Check for overlap
      if (startDate <= period.end && endDate >= period.start) {
        return false;
      }
    }
    return true;
  };

  const markUnitOccupied = (unitId: string, startDate: Date, endDate: Date) => {
    if (!unitOccupancy.has(unitId)) {
      unitOccupancy.set(unitId, []);
    }
    unitOccupancy.get(unitId)!.push({ start: startDate, end: endDate });
  };

  let leaseCount = 0;
  const activeTenants = tenants.filter((t) => t.status === "ACTIVE");
  const expiredTenants = tenants.filter((t) => t.status === "EXPIRED");
  const bookedTenants = tenants.filter((t) => t.status === "BOOKED");
  const leadTenants = tenants.filter((t) => t.status === "LEAD");

  // Define today and twoMonthsFromNow here (used across all lease creation)
  const today = new Date();
  const twoMonthsFromNow = addMonths(today, 2);

  // Create historical leases (2024 - ended) - Simpler approach with fewer leases
  console.log("  Creating historical leases (2024 - ended)...");

  const historicalLeases: LeaseData[] = [];

  // Each unit gets 3-8 historical ENDED leases (not every single month)
  for (const unit of allUnits) {
    const tenant = expiredTenants[Math.floor(Math.random() * expiredTenants.length)];
    const paymentCycle = paymentCycles[Math.floor(Math.random() * paymentCycles.length)];

    const numHistoricalLeases = Math.floor(Math.random() * 6) + 3; // 3-8 leases
    let currentStartDate = createDate(2024, 1, Math.floor(Math.random() * 28) + 1);

    for (let i = 0; i < numHistoricalLeases; i++) {
      // Each lease is ONE payment period
      let endDate: Date;
      if (paymentCycle === "DAILY") {
        endDate = addDays(currentStartDate, 1);
      } else if (paymentCycle === "MONTHLY") {
        endDate = addMonths(currentStartDate, 1);
        endDate = addDays(endDate, -1);
      } else {
        // ANNUAL
        endDate = addMonths(currentStartDate, 12);
        endDate = addDays(endDate, -1);
      }

      // Stop if end date is beyond today
      if (endDate >= today) break;

      const rentAmount = Number(
        paymentCycle === "ANNUAL"
          ? unit.annualRate
          : paymentCycle === "MONTHLY"
            ? unit.monthlyRate
            : unit.dailyRate,
      );
      const depositAmount = i === 0
        ? Math.round(rentAmount * (Math.random() * 0.5 + 1))
        : null; // Only first lease has deposit

      historicalLeases.push({
        tenantId: tenant.id,
        unitId: unit.id,
        organizationId: org.id,
        startDate: currentStartDate,
        endDate,
        paymentCycle,
        rentAmount,
        depositAmount,
        depositStatus: depositAmount ? (Math.random() > 0.3 ? "RETURNED" : "HELD") : null,
        status: "ENDED",
        paidAt: currentStartDate,
        paymentMethod:
          paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        paymentStatus: "COMPLETED",
        isAutoRenew: false,
      });

      markUnitOccupied(unit.id, currentStartDate, endDate);

      // Next lease starts after a gap
      if (paymentCycle === "DAILY") {
        // Daily leases: 3-7 days gap between rentals (not every single day)
        currentStartDate = addDays(endDate, Math.floor(Math.random() * 5) + 3);
      } else {
        // Monthly/Annual: 1-3 days gap
        currentStartDate = addDays(endDate, Math.floor(Math.random() * 3) + 1);
      }
    }
  }

  // Bulk insert historical leases
  await prisma.leaseAgreement.createMany({
    data: historicalLeases,
  });
  leaseCount += historicalLeases.length;
  console.log(`  ✓ Created ${historicalLeases.length} historical leases`);

  // Create active leases (current payment period, ending within 2 months from now)
  console.log("  Creating active leases (current payment period)...");

  const activeLeases: LeaseData[] = [];

  // 70% of units should have an active lease
  const unitsForActiveLease = allUnits
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(allUnits.length * 0.7));

  for (const unit of unitsForActiveLease) {
    const tenant = activeTenants[leaseCount % activeTenants.length];
    const paymentCycle = paymentCycles[leaseCount % paymentCycles.length];

    // Get the last occupation date for this unit
    const occupancies = unitOccupancy.get(unit.id) || [];
    let currentStartDate: Date;

    if (occupancies.length > 0) {
      // Continue from where historical leases left off
      const lastEnd = occupancies[occupancies.length - 1].end;
      currentStartDate = addDays(lastEnd, 1);
    } else {
      // Random start date that ensures lease is still active
      // Start 1-6 months ago
      const monthsAgo = Math.floor(Math.random() * 6) + 1;
      currentStartDate = addMonths(today, -monthsAgo);
    }

    // Calculate end date for ACTIVE lease (between today and 2 months from now)
    let endDate: Date;
    if (paymentCycle === "DAILY") {
      endDate = addDays(currentStartDate, 1);
    } else if (paymentCycle === "MONTHLY") {
      endDate = addMonths(currentStartDate, 1);
      endDate = addDays(endDate, -1);
    } else {
      // ANNUAL
      endDate = addMonths(currentStartDate, 12);
      endDate = addDays(endDate, -1);
    }

    // Ensure it's still active (ends after today)
    while (endDate < today) {
      currentStartDate = addDays(endDate, 1);
      if (paymentCycle === "DAILY") {
        endDate = addDays(currentStartDate, 1);
      } else if (paymentCycle === "MONTHLY") {
        endDate = addMonths(currentStartDate, 1);
        endDate = addDays(endDate, -1);
      } else {
        endDate = addMonths(currentStartDate, 12);
        endDate = addDays(endDate, -1);
      }
    }

    // Cap at 2 months from now
    if (endDate > twoMonthsFromNow) {
      endDate = twoMonthsFromNow;
    }

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const depositAmount = Math.round(rentAmount * (Math.random() * 0.5 + 1));
    const isAutoRenew = Math.random() > 0.6;

    activeLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate: currentStartDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount,
      depositStatus: "HELD",
      status: "ACTIVE",
      paidAt: currentStartDate,
      paymentMethod:
        paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      paymentStatus: "COMPLETED",
      isAutoRenew,
      gracePeriodDays: isAutoRenew ? Math.floor(Math.random() * 5) + 3 : null,
      autoRenewalNoticeDays: isAutoRenew
        ? Math.floor(Math.random() * 20) + 10
        : null,
    });

    markUnitOccupied(unit.id, currentStartDate, endDate);
    leaseCount++;
  }

  // Bulk insert active leases
  await prisma.leaseAgreement.createMany({
    data: activeLeases,
  });
  console.log(`  ✓ Created ${activeLeases.length} active leases`);

  // Create booked/draft leases (future leases - starting within next 2 months)
  console.log(
    "  Creating booked/draft leases (future - within next 2 months)...",
  );

  const draftLeases: LeaseData[] = [];

  // Get units that don't have active leases (remaining 30%)
  const unitsWithoutActive = allUnits.filter(
    unit => !unitsForActiveLease.includes(unit)
  );

  // ALL units without active leases get draft leases (100% instead of 50%)
  const unitsForDraft = unitsWithoutActive;

  for (const unit of unitsForDraft) {
    const tenant =
      leaseCount < bookedTenants.length
        ? bookedTenants[leaseCount % bookedTenants.length]
        : leadTenants[leaseCount % leadTenants.length];

    // Get the last occupation date for this unit
    const occupancies = unitOccupancy.get(unit.id) || [];
    let startDate: Date;

    if (occupancies.length > 0) {
      // Start after the last lease ended (plus 1-7 days gap)
      const lastEnd = occupancies[occupancies.length - 1].end;
      startDate = addDays(lastEnd, Math.floor(Math.random() * 7) + 1);
    } else {
      // Random start date within next 2 months
      const daysUntilStart = Math.floor(Math.random() * 60);
      startDate = addDays(today, daysUntilStart);
    }

    // Ensure start date is within next 2 months
    if (startDate > twoMonthsFromNow) {
      startDate = addDays(today, Math.floor(Math.random() * 60));
    }

    const paymentCycle = paymentCycles[leaseCount % paymentCycles.length];

    // Each lease is ONE payment period
    let endDate: Date;
    if (paymentCycle === "DAILY") {
      endDate = addDays(startDate, 1);
    } else if (paymentCycle === "MONTHLY") {
      endDate = addMonths(startDate, 1);
      endDate = addDays(endDate, -1);
    } else {
      endDate = addMonths(startDate, 12);
      endDate = addDays(endDate, -1);
    }

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const depositAmount = Math.round(rentAmount * (Math.random() * 0.5 + 1));

    // DRAFT leases can't have paidAt - that would make them ACTIVE
    // Add grace period to some draft leases (50% chance)
    const hasGracePeriod = Math.random() > 0.5;
    draftLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount,
      status: "DRAFT",
      paidAt: null,
      paymentMethod: null,
      paymentStatus: "PENDING",
      gracePeriodDays: hasGracePeriod ? Math.floor(Math.random() * 7) + 3 : null, // 3-9 days grace period
    });

    markUnitOccupied(unit.id, startDate, endDate);
    leaseCount++;
  }

  // Bulk insert draft leases
  await prisma.leaseAgreement.createMany({
    data: draftLeases,
  });
  console.log(`  ✓ Created ${draftLeases.length} draft leases`);

  // Create additional DRAFT leases for units that already have active leases
  // These represent future bookings (next month/period)
  console.log(
    "  Creating additional draft leases (future bookings for currently occupied units)...",
  );

  const additionalDraftLeases: LeaseData[] = [];

  // 40% of units with active leases get a future draft lease
  const unitsForAdditionalDraft = unitsForActiveLease
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.floor(unitsForActiveLease.length * 0.4));

  for (const unit of unitsForAdditionalDraft) {
    const tenant =
      leaseCount < bookedTenants.length
        ? bookedTenants[leaseCount % bookedTenants.length]
        : leadTenants[leaseCount % leadTenants.length];

    // Get the last occupation date for this unit
    const occupancies = unitOccupancy.get(unit.id) || [];
    let startDate: Date;

    if (occupancies.length > 0) {
      // Start after the last lease ends (plus 1-3 days gap)
      const lastEnd = occupancies[occupancies.length - 1].end;
      startDate = addDays(lastEnd, Math.floor(Math.random() * 3) + 1);
    } else {
      // Random start date within next 2 months
      const daysUntilStart = Math.floor(Math.random() * 60);
      startDate = addDays(today, daysUntilStart);
    }

    const paymentCycle = paymentCycles[leaseCount % paymentCycles.length];

    // Each lease is ONE payment period
    let endDate: Date;
    if (paymentCycle === "DAILY") {
      endDate = addDays(startDate, 1);
    } else if (paymentCycle === "MONTHLY") {
      endDate = addMonths(startDate, 1);
      endDate = addDays(endDate, -1);
    } else {
      endDate = addMonths(startDate, 12);
      endDate = addDays(endDate, -1);
    }

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const depositAmount = Math.round(rentAmount * (Math.random() * 0.5 + 1));

    // Add grace period to 60% of these draft leases
    const hasGracePeriod = Math.random() > 0.4;
    additionalDraftLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount,
      status: "DRAFT",
      paidAt: null,
      paymentMethod: null,
      paymentStatus: "PENDING",
      gracePeriodDays: hasGracePeriod ? Math.floor(Math.random() * 7) + 3 : null, // 3-9 days grace period
    });

    markUnitOccupied(unit.id, startDate, endDate);
    leaseCount++;
  }

  // Bulk insert additional draft leases
  await prisma.leaseAgreement.createMany({
    data: additionalDraftLeases,
  });
  console.log(`  ✓ Created ${additionalDraftLeases.length} additional draft leases for future bookings`);

  // Create some DRAFT leases with payment due in the PAST (overdue) and spread across the next 60 days
  console.log(
    "  Creating draft leases spread across calendar (including overdue)...",
  );

  const spreadDraftLeases: LeaseData[] = [];

  // Create 30 draft leases spread from -15 days to +60 days
  for (let i = 0; i < 30; i++) {
    // Random unit
    const unit = allUnits[Math.floor(Math.random() * allUnits.length)];

    // Random tenant from booked or lead
    const tenant =
      Math.random() > 0.5
        ? bookedTenants[Math.floor(Math.random() * bookedTenants.length)]
        : leadTenants[Math.floor(Math.random() * leadTenants.length)];

    // Spread start dates from 15 days ago to 60 days in the future
    // This creates a mix of overdue and upcoming payments
    const daysOffset = Math.floor(Math.random() * 75) - 15; // -15 to +60
    const startDate = addDays(today, daysOffset);

    const paymentCycle = paymentCycles[Math.floor(Math.random() * paymentCycles.length)];

    // Each lease is ONE payment period
    let endDate: Date;
    if (paymentCycle === "DAILY") {
      endDate = addDays(startDate, 1);
    } else if (paymentCycle === "MONTHLY") {
      endDate = addMonths(startDate, 1);
      endDate = addDays(endDate, -1);
    } else {
      endDate = addMonths(startDate, 12);
      endDate = addDays(endDate, -1);
    }

    // Check if unit is available (skip if overlap)
    if (!isUnitAvailable(unit.id, startDate, endDate)) continue;

    const rentAmount = Number(
      paymentCycle === "ANNUAL"
        ? unit.annualRate
        : paymentCycle === "MONTHLY"
          ? unit.monthlyRate
          : unit.dailyRate,
    );
    const depositAmount = Math.round(rentAmount * (Math.random() * 0.5 + 1));

    // 70% have grace periods
    const hasGracePeriod = Math.random() > 0.3;
    spreadDraftLeases.push({
      tenantId: tenant.id,
      unitId: unit.id,
      organizationId: org.id,
      startDate,
      endDate,
      paymentCycle,
      rentAmount,
      depositAmount,
      status: "DRAFT",
      paidAt: null,
      paymentMethod: null,
      paymentStatus: "PENDING",
      gracePeriodDays: hasGracePeriod ? Math.floor(Math.random() * 7) + 3 : null, // 3-9 days grace period
    });

    markUnitOccupied(unit.id, startDate, endDate);
  }

  // Bulk insert spread draft leases
  await prisma.leaseAgreement.createMany({
    data: spreadDraftLeases,
  });
  console.log(`  ✓ Created ${spreadDraftLeases.length} spread draft leases (including overdue payments)`);

  // Create some cancelled leases
  console.log("  Creating cancelled leases...");
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

    // One payment period
    const endDate = addMonths(startDate, 1);
    const finalEndDate = addDays(endDate, -1);

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

  // Bulk insert cancelled leases
  await prisma.leaseAgreement.createMany({
    data: cancelledLeases,
  });
  console.log(`  ✓ Created ${cancelledLeases.length} cancelled leases`);

  console.log(`\n✓ Created ${leaseCount} total leases`);

  // ===========================================
  // Create Additional Test Users with Different Roles
  // ===========================================

  console.log("👤 Creating additional test users with different roles...");

  const testUsers = [];

  // Create Property Manager users
  for (let i = 1; i <= 3; i++) {
    const email = `manager${i}@test.com`;
    const hashedPassword = await bcrypt.hash("Password1!", 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { hashedPassword },
      create: {
        email,
        name: `Property Manager ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: propertyManagerRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: propertyManagerRole.id,
      },
    });

    testUsers.push(user);
  }

  // Create Notification Manager users
  for (let i = 1; i <= 2; i++) {
    const email = `notifier${i}@test.com`;
    const hashedPassword = await bcrypt.hash("Password1!", 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { hashedPassword },
      create: {
        email,
        name: `Notification Manager ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: notificationManagerRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: notificationManagerRole.id,
      },
    });

    testUsers.push(user);
  }

  // Create Maintenance Staff role
  const maintenanceStaffRole = await prisma.role.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Maintenance Staff",
      },
    },
    update: {},
    create: {
      name: "Maintenance Staff",
      isSystem: false,
      organizationId: org.id,
    },
  });

  // Link maintenance-related accesses to Maintenance Staff role
  const maintenanceAccessResources = ["maintenance", "properties"];
  for (const access of accesses) {
    if (maintenanceAccessResources.includes(access.resource)) {
      await prisma.roleAccess.upsert({
        where: {
          roleId_accessId: {
            roleId: maintenanceStaffRole.id,
            accessId: access.id,
          },
        },
        update: {},
        create: {
          roleId: maintenanceStaffRole.id,
          accessId: access.id,
        },
      });
    }
  }

  // Create Maintenance Staff users
  for (let i = 1; i <= 4; i++) {
    const email = `maintenance${i}@test.com`;
    const hashedPassword = await bcrypt.hash("Password1!", 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { hashedPassword },
      create: {
        email,
        name: `Maintenance Staff ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: maintenanceStaffRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: maintenanceStaffRole.id,
      },
    });

    testUsers.push(user);
  }

  // Create Viewer role (read-only)
  const viewerRole = await prisma.role.upsert({
    where: {
      organizationId_name: {
        organizationId: org.id,
        name: "Viewer",
      },
    },
    update: {},
    create: {
      name: "Viewer",
      isSystem: false,
      organizationId: org.id,
    },
  });

  // Link read-only accesses to Viewer role
  for (const access of accesses) {
    if (access.action === "read") {
      await prisma.roleAccess.upsert({
        where: {
          roleId_accessId: {
            roleId: viewerRole.id,
            accessId: access.id,
          },
        },
        update: {},
        create: {
          roleId: viewerRole.id,
          accessId: access.id,
        },
      });
    }
  }

  // Create Viewer users
  for (let i = 1; i <= 2; i++) {
    const email = `viewer${i}@test.com`;
    const hashedPassword = await bcrypt.hash("Password1!", 10);
    const user = await prisma.user.upsert({
      where: { email },
      update: { hashedPassword },
      create: {
        email,
        name: `Viewer ${i}`,
        hashedPassword,
        organizationId: org.id,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: viewerRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: viewerRole.id,
      },
    });

    testUsers.push(user);
  }

  console.log(
    `✓ Created ${testUsers.length} additional test users with various roles`,
  );

  // ===========================================
  // Create Many Maintenance Requests for Leases
  // ===========================================

  console.log("🔧 Creating maintenance requests for leases...");

  // Fetch all leases to create maintenance for
  const allLeases = await prisma.leaseAgreement.findMany({
    include: {
      unit: {
        include: {
          property: true,
        },
      },
      tenant: true,
    },
  });

  const maintenanceIssues = [
    {
      title: "Leaking Faucet",
      description: "Kitchen faucet drips constantly even when closed.",
      priority: "MEDIUM" as const,
      estimatedCost: 150,
    },
    {
      title: "Broken Window",
      description: "Bedroom window won't close properly.",
      priority: "HIGH" as const,
      estimatedCost: 300,
    },
    {
      title: "AC Not Cooling",
      description: "Air conditioning unit runs but doesn't cool the room.",
      priority: "URGENT" as const,
      estimatedCost: 500,
    },
    {
      title: "Clogged Drain",
      description: "Bathroom sink drains very slowly.",
      priority: "MEDIUM" as const,
      estimatedCost: 100,
    },
    {
      title: "Light Fixture Out",
      description: "Ceiling light in living room not working.",
      priority: "LOW" as const,
      estimatedCost: 50,
    },
    {
      title: "Door Lock Stuck",
      description: "Front door lock is difficult to turn.",
      priority: "HIGH" as const,
      estimatedCost: 200,
    },
    {
      title: "Water Heater Issue",
      description: "Hot water runs out very quickly.",
      priority: "HIGH" as const,
      estimatedCost: 400,
    },
    {
      title: "Pest Problem",
      description: "Noticed cockroaches in the kitchen area.",
      priority: "URGENT" as const,
      estimatedCost: 250,
    },
    {
      title: "Refrigerator Not Cold",
      description: "Refrigerator not maintaining temperature.",
      priority: "URGENT" as const,
      estimatedCost: 350,
    },
    {
      title: "Toilet Running",
      description: "Toilet keeps running after flush.",
      priority: "MEDIUM" as const,
      estimatedCost: 120,
    },
    {
      title: "Paint Peeling",
      description: "Paint peeling off walls in multiple rooms.",
      priority: "LOW" as const,
      estimatedCost: 300,
    },
    {
      title: "Garbage Disposal Jammed",
      description: "Kitchen garbage disposal won't turn on.",
      priority: "MEDIUM" as const,
      estimatedCost: 180,
    },
    {
      title: "Smoke Detector Beeping",
      description: "Smoke detector beeps intermittently.",
      priority: "HIGH" as const,
      estimatedCost: 75,
    },
    {
      title: "Heating Not Working",
      description: "Heater doesn't turn on at all.",
      priority: "URGENT" as const,
      estimatedCost: 450,
    },
    {
      title: "Carpet Stain",
      description: "Large stain on living room carpet needs cleaning.",
      priority: "LOW" as const,
      estimatedCost: 150,
    },
  ];

  const maintenanceStatuses: Array<
    "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  > = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

  let maintenanceCount = 0;

  // Create maintenance for ended leases (more likely to be completed)
  const endedLeases = allLeases.filter((l) => l.status === "ENDED");
  for (const lease of endedLeases) {
    // 60% chance of having maintenance issues
    if (Math.random() > 0.4) {
      const issueCount = Math.floor(Math.random() * 3) + 1; // 1-3 issues per lease

      for (let i = 0; i < issueCount; i++) {
        const issue =
          maintenanceIssues[
            Math.floor(Math.random() * maintenanceIssues.length)
          ];
        const status =
          Math.random() > 0.2
            ? "COMPLETED"
            : maintenanceStatuses[
                Math.floor(Math.random() * maintenanceStatuses.length)
              ];

        const createdDate = new Date(
          lease.startDate.getTime() +
            Math.random() *
              (lease.endDate.getTime() - lease.startDate.getTime()),
        );
        const actualCost =
          status === "COMPLETED"
            ? Math.round(issue.estimatedCost * (0.8 + Math.random() * 0.4))
            : null;
        const completedAt =
          status === "COMPLETED"
            ? new Date(
                createdDate.getTime() +
                  Math.random() * 14 * 24 * 60 * 60 * 1000,
              )
            : null;

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

  // Create maintenance for active leases (mix of statuses)
  const activeLeasesForMaintenance = allLeases.filter((l) => l.status === "ACTIVE");
  for (const lease of activeLeasesForMaintenance) {
    // 40% chance of having maintenance issues
    if (Math.random() > 0.6) {
      const issueCount = Math.floor(Math.random() * 2) + 1; // 1-2 issues per lease

      for (let i = 0; i < issueCount; i++) {
        const issue =
          maintenanceIssues[
            Math.floor(Math.random() * maintenanceIssues.length)
          ];
        const statusRand = Math.random();
        let status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
        if (statusRand > 0.7) status = "COMPLETED";
        else if (statusRand > 0.4) status = "IN_PROGRESS";
        else if (statusRand > 0.1) status = "OPEN";
        else status = "CANCELLED";

        const daysSinceStart = Math.floor(
          (Date.now() - lease.startDate.getTime()) / (24 * 60 * 60 * 1000),
        );
        const createdDate = new Date(
          lease.startDate.getTime() +
            Math.random() * daysSinceStart * 24 * 60 * 60 * 1000,
        );
        const actualCost =
          status === "COMPLETED"
            ? Math.round(issue.estimatedCost * (0.8 + Math.random() * 0.4))
            : null;
        const completedAt =
          status === "COMPLETED"
            ? new Date(
                createdDate.getTime() +
                  Math.random() * 14 * 24 * 60 * 60 * 1000,
              )
            : null;

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

  console.log(`✓ Created ${maintenanceCount} maintenance requests for leases`);

  // ===========================================
  // Create Notification History
  // ===========================================

  console.log("📧 Creating notification history...");

  let notificationCount = 0;

  // Fetch all leases with relations for notifications
  const allLeasesWithRelations = await prisma.leaseAgreement.findMany({
    where: { organizationId: org.id },
    include: {
      tenant: true,
      unit: {
        include: {
          property: true,
        },
      },
    },
  });

  // Create notification logs for various triggers
  const notificationTriggers: Array<
    | "PAYMENT_REMINDER"
    | "PAYMENT_LATE"
    | "PAYMENT_CONFIRMED"
    | "LEASE_EXPIRING"
    | "LEASE_EXPIRED"
    | "MANUAL"
  > = [
    "PAYMENT_REMINDER",
    "PAYMENT_LATE",
    "PAYMENT_CONFIRMED",
    "LEASE_EXPIRING",
    "LEASE_EXPIRED",
    "MANUAL",
  ];

  const notificationChannels: Array<"EMAIL" | "WHATSAPP" | "TELEGRAM"> = [
    "EMAIL",
    "WHATSAPP",
    "TELEGRAM",
  ];

  // Create notifications for ended leases
  const endedLeasesWithRelations = allLeasesWithRelations.filter((l) => l.status === "ENDED");
  for (const lease of endedLeasesWithRelations.slice(0, 100)) {
    // Limit to first 100 to avoid too many
    // Payment reminder sent before lease started
    const reminderDate = new Date(
      lease.startDate.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
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

    // Payment confirmed
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

    // Lease expiring notification
    const expiringDate = new Date(
      lease.endDate.getTime() - 14 * 24 * 60 * 60 * 1000,
    );
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

    // Lease expired notification
    const expiredDate = new Date(
      lease.endDate.getTime() + 1 * 24 * 60 * 60 * 1000,
    );
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: lease.tenant.email,
        recipientPhone: lease.tenant.phone,
        trigger: "LEASE_EXPIRED",
        channel: "EMAIL",
        subject: `Lease Expired - ${lease.unit.property.name}`,
        body: `Dear ${lease.tenant.fullName}, your lease has expired. Please contact us regarding move-out procedures.`,
        status: "SENT",
        sentAt: expiredDate,
        createdAt: expiredDate,
      },
    });
    notificationCount++;
  }

  // Create notifications for active leases
  const activeLeasesWithRelations = allLeasesWithRelations.filter((l) => l.status === "ACTIVE");
  for (const lease of activeLeasesWithRelations.slice(0, 80)) {
    // Limit to first 80
    // Payment reminder
    const reminderDate = new Date(
      lease.startDate.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: lease.tenant.email,
        recipientPhone: lease.tenant.phone,
        trigger: "PAYMENT_REMINDER",
        channel: lease.tenant.preferWhatsapp ? "WHATSAPP" : "EMAIL",
        subject: lease.tenant.preferWhatsapp
          ? null
          : `Payment Reminder - ${lease.unit.property.name}`,
        body: `Dear ${lease.tenant.fullName}, your rent payment of $${lease.rentAmount} is due soon.`,
        status: "SENT",
        sentAt: reminderDate,
        createdAt: reminderDate,
      },
    });
    notificationCount++;

    // Payment confirmed
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

    // Some failed notifications (5% failure rate)
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
          createdAt: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          ),
        },
      });
      notificationCount++;
    }
  }

  // Create some pending notifications
  for (let i = 0; i < 20; i++) {
    const randomLease =
      activeLeasesWithRelations[Math.floor(Math.random() * activeLeasesWithRelations.length)];
    await prisma.notificationLog.create({
      data: {
        organizationId: org.id,
        recipientEmail: randomLease.tenant.email,
        recipientPhone: randomLease.tenant.phone,
        trigger:
          notificationTriggers[
            Math.floor(Math.random() * notificationTriggers.length)
          ],
        channel:
          notificationChannels[
            Math.floor(Math.random() * notificationChannels.length)
          ],
        subject: `Notification - ${randomLease.unit.property.name}`,
        body: `Dear ${randomLease.tenant.fullName}, this is a test notification.`,
        status: "PENDING",
        createdAt: new Date(
          Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000,
        ),
      },
    });
    notificationCount++;
  }

  console.log(`✓ Created ${notificationCount} notification logs`);

  console.log("✓ Linked features to tiers");

  // Create notification templates
  const paymentReminderEmailTemplate = await prisma.notificationTemplate.create(
    {
      data: {
        organizationId: org.id,
        name: "Payment Reminder Email",
        trigger: "PAYMENT_REMINDER",
        channel: "EMAIL",
        subject: "Payment Reminder - {{propertyName}}",
        body: `Dear {{tenantName}},

This is a friendly reminder that your rent payment is due soon.

Property: {{propertyName}} - {{unitName}}
Amount: {{rentAmount}}
Due Date: {{leaseStartDate}}

Please ensure payment is made on time to avoid any late fees.

Thank you,
Haventium Property Management`,
        isActive: true,
      },
    },
  );

  const leaseExpiringEmailTemplate = await prisma.notificationTemplate.create({
    data: {
      organizationId: org.id,
      name: "Lease Expiring Email",
      trigger: "LEASE_EXPIRING",
      channel: "EMAIL",
      subject: "Your Lease is Expiring Soon - {{propertyName}}",
      body: `Dear {{tenantName}},

We wanted to inform you that your lease agreement is expiring soon.

Property: {{propertyName}} - {{unitName}}
Lease End Date: {{leaseEndDate}}

Please contact us if you would like to renew your lease or discuss your options.

Thank you,
Haventium Property Management`,
      isActive: true,
    },
  });

  const paymentConfirmedEmailTemplate =
    await prisma.notificationTemplate.create({
      data: {
        organizationId: org.id,
        name: "Payment Confirmed Email",
        trigger: "PAYMENT_CONFIRMED",
        channel: "EMAIL",
        subject: "Payment Received - {{propertyName}}",
        body: `Dear {{tenantName}},

Thank you! We have received your payment.

Property: {{propertyName}} - {{unitName}}
Amount: {{rentAmount}}
Payment Date: {{leaseStartDate}}

Your lease is now active. If you have any questions, please don't hesitate to contact us.

Thank you,
Haventium Property Management`,
        isActive: true,
      },
    });

  console.log("✓ Created notification templates");

  // Create notification rules
  const paymentReminderRule = await prisma.notificationRule.create({
    data: {
      organizationId: org.id,
      name: "Payment Reminder 7 Days Before",
      trigger: "PAYMENT_REMINDER",
      daysOffset: -7, // 7 days before payment due
      channels: ["EMAIL"],
      recipientType: "TENANT",
      isActive: true,
    },
  });

  const leaseExpiringRule = await prisma.notificationRule.create({
    data: {
      organizationId: org.id,
      name: "Lease Expiring 14 Days Before",
      trigger: "LEASE_EXPIRING",
      daysOffset: -14, // 14 days before lease ends
      channels: ["EMAIL"],
      recipientType: "TENANT",
      isActive: true,
    },
  });

  const paymentConfirmedRule = await prisma.notificationRule.create({
    data: {
      organizationId: org.id,
      name: "Payment Confirmed Notification",
      trigger: "PAYMENT_CONFIRMED",
      daysOffset: 0, // Same day as payment
      channels: ["EMAIL"],
      recipientType: "TENANT",
      isActive: true,
    },
  });

  console.log("✓ Created notification rules");

  // Create sample maintenance requests
  const sampleProperty = properties[0];
  const sampleUnit = allUnits[0];
  const sampleTenant = activeTenants[0];

  const maintenanceReq1 = await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: sampleProperty.id,
      unitId: sampleUnit.id,
      tenantId: sampleTenant.id,
      title: "Leaking Faucet in Kitchen",
      description:
        "The kitchen faucet has been leaking for the past few days. Water drips constantly even when fully closed.",
      status: "OPEN",
      priority: "MEDIUM",
      estimatedCost: 150,
    },
  });

  const maintenanceReq2 = await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: properties[1].id,
      unitId: allUnits[5].id,
      tenantId: activeTenants[1].id,
      title: "Air Conditioning Not Working",
      description:
        "The AC unit stopped working completely. Unit is getting very hot, especially at night.",
      status: "IN_PROGRESS",
      priority: "URGENT",
      estimatedCost: 500,
      actualCost: 450,
    },
  });

  const maintenanceReq3 = await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: properties[2].id,
      unitId: allUnits[10].id,
      title: "Replace Air Filter",
      description: "Routine air filter replacement for HVAC system.",
      status: "COMPLETED",
      priority: "LOW",
      estimatedCost: 50,
      actualCost: 45,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  const maintenanceReq4 = await prisma.maintenanceRequest.create({
    data: {
      organizationId: org.id,
      propertyId: sampleProperty.id,
      title: "Common Area Light Fixtures",
      description:
        "Several light fixtures in the hallway need bulb replacements.",
      status: "OPEN",
      priority: "LOW",
    },
  });

  console.log("✓ Created 4 maintenance requests");

  // Create sample documents (Note: we can't upload actual files to Vercel Blob in seed, so we'll create placeholder metadata)
  // In real usage, these would be created via the upload endpoint
  const doc1 = await prisma.document.create({
    data: {
      organizationId: org.id,
      propertyId: sampleProperty.id,
      unitId: sampleUnit.id,
      tenantId: sampleTenant.id,
      filename: "lease-agreement-sample.pdf",
      fileType: "application/pdf",
      fileSize: 245678,
      fileUrl: "https://example.com/placeholder/lease-agreement.pdf",
      storageKey: "seed-placeholder-lease-agreement",
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      organizationId: org.id,
      propertyId: sampleProperty.id,
      tenantId: sampleTenant.id,
      filename: "tenant-id-proof.pdf",
      fileType: "application/pdf",
      fileSize: 189432,
      fileUrl: "https://example.com/placeholder/id-proof.pdf",
      storageKey: "seed-placeholder-id-proof",
    },
  });

  const doc3 = await prisma.document.create({
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

  console.log("✓ Created 3 documents");

  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
