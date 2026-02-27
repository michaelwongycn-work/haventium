import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function seedConstants(db: PrismaClient) {
  // ─── Subscription Tiers ───────────────────────────────────────────────────
  const freeTier = await db.subscriptionTier.upsert({
    where: { type: "FREE" },
    update: {
      name: "Free Plan",
      maxUsers: 1,
      maxProperties: 1,
      maxUnits: 10,
      maxTenants: 100,
    },
    create: {
      type: "FREE",
      name: "Free Plan",
      monthlyPrice: 0,
      annualPrice: 0,
      maxUsers: 1,
      maxProperties: 1,
      maxUnits: 10,
      maxTenants: 100,
    },
  });

  const normalTier = await db.subscriptionTier.upsert({
    where: { type: "NORMAL" },
    update: {
      name: "Standard Plan",
      maxUsers: 5,
      maxProperties: 5,
      maxUnits: 50,
      maxTenants: 1000,
    },
    create: {
      type: "NORMAL",
      name: "Standard Plan",
      monthlyPrice: 100000,
      annualPrice: 1100000,
      maxUsers: 5,
      maxProperties: 5,
      maxUnits: 50,
      maxTenants: 1000,
    },
  });

  const proTier = await db.subscriptionTier.upsert({
    where: { type: "PRO" },
    update: {
      name: "Pro Plan",
      maxUsers: 10,
      maxProperties: 10,
      maxUnits: 100,
      maxTenants: 10000,
    },
    create: {
      type: "PRO",
      name: "Pro Plan",
      monthlyPrice: 250000,
      annualPrice: 2500000,
      maxUsers: 10,
      maxProperties: 10,
      maxUnits: 100,
      maxTenants: 10000,
    },
  });

  console.log("✓ Upserted subscription tiers");

  // ─── Features ─────────────────────────────────────────────────────────────
  const docManagement = await db.feature.upsert({
    where: { code: "DOCUMENT_MANAGEMENT" },
    update: { name: "Document Management" },
    create: { code: "DOCUMENT_MANAGEMENT", name: "Document Management" },
  });

  const maintenanceMgmt = await db.feature.upsert({
    where: { code: "MAINTENANCE_MANAGEMENT" },
    update: { name: "Maintenance Management" },
    create: { code: "MAINTENANCE_MANAGEMENT", name: "Maintenance Management" },
  });

  const reminder = await db.feature.upsert({
    where: { code: "REMINDER" },
    update: { name: "Reminder" },
    create: { code: "REMINDER", name: "Reminder" },
  });

  const paymentGateway = await db.feature.upsert({
    where: { code: "PAYMENT_GATEWAY" },
    update: { name: "Payment Gateway Integration" },
    create: {
      code: "PAYMENT_GATEWAY",
      name: "Payment Gateway Integration",
    },
  });

  const tenantPortal = await db.feature.upsert({
    where: { code: "TENANT_PORTAL" },
    update: { name: "Tenant Portal" },
    create: { code: "TENANT_PORTAL", name: "Tenant Portal" },
  });

  const analytics = await db.feature.upsert({
    where: { code: "ANALYTICS" },
    update: { name: "Analytics & Reports" },
    create: { code: "ANALYTICS", name: "Analytics & Reports" },
  });

  const bulkImport = await db.feature.upsert({
    where: { code: "BULK_IMPORT" },
    update: { name: "Bulk Import" },
    create: { code: "BULK_IMPORT", name: "Bulk Import" },
  });

  const calendar = await db.feature.upsert({
    where: { code: "CALENDAR" },
    update: { name: "Calendar View" },
    create: { code: "CALENDAR", name: "Calendar View" },
  });

  const activityLog = await db.feature.upsert({
    where: { code: "ACTIVITY_LOG" },
    update: { name: "Activity Log" },
    create: { code: "ACTIVITY_LOG", name: "Activity Log" },
  });

  const customRoles = await db.feature.upsert({
    where: { code: "CUSTOM_ROLES" },
    update: { name: "Custom Roles" },
    create: { code: "CUSTOM_ROLES", name: "Custom Roles" },
  });

  console.log("✓ Upserted features");

  // ─── Tier → Feature links ─────────────────────────────────────────────────
  // Clear and re-link to keep them in sync with code
  await db.tierFeature.deleteMany({
    where: { tierId: { in: [freeTier.id, normalTier.id, proTier.id] } },
  });

  // FREE: no features
  // STANDARD: doc, maintenance, reminder, tenant portal, bulk import, calendar
  for (const feature of [
    docManagement,
    maintenanceMgmt,
    reminder,
    tenantPortal,
    bulkImport,
    calendar,
  ]) {
    await db.tierFeature.create({
      data: { tierId: normalTier.id, featureId: feature.id },
    });
  }

  // PRO: all features including custom roles
  for (const feature of [
    docManagement,
    maintenanceMgmt,
    reminder,
    paymentGateway,
    tenantPortal,
    analytics,
    bulkImport,
    calendar,
    activityLog,
    customRoles,
  ]) {
    await db.tierFeature.create({
      data: { tierId: proTier.id, featureId: feature.id },
    });
  }

  console.log("✓ Linked features to tiers");

  // ─── Default Accesses ─────────────────────────────────────────────────────
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
    const access = await db.access.upsert({
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

  console.log("✓ Upserted default accesses");

  return { freeTier, normalTier, proTier, accesses };
}

// Predefined system roles for Standard (non-PRO) orgs.
// These are immutable — users cannot edit or delete them.
export async function seedSystemRoles(
  db: PrismaClient,
  organizationId: string,
  accesses: { id: string; resource: string; action: string }[],
) {
  const definitions = [
    {
      name: "Owner",
      resources: null, // all
      actions: null,   // all
    },
    {
      name: "Property Manager",
      resources: ["properties", "tenants", "leases", "payments", "notifications"],
      actions: null,
    },
    {
      name: "Maintenance Staff",
      resources: ["maintenance", "properties"],
      actions: null,
    },
    {
      name: "Notification Manager",
      resources: ["notifications"],
      actions: null,
    },
    {
      name: "Viewer",
      resources: null,
      actions: ["read"],
    },
  ];

  for (const def of definitions) {
    const role = await db.role.upsert({
      where: { organizationId_name: { organizationId, name: def.name } },
      update: { isSystem: true },
      create: { name: def.name, isSystem: true, organizationId },
    });

    const filteredAccesses = accesses.filter((a) => {
      const resourceMatch = !def.resources || def.resources.includes(a.resource);
      const actionMatch = !def.actions || def.actions.includes(a.action);
      return resourceMatch && actionMatch;
    });

    for (const access of filteredAccesses) {
      await db.roleAccess.upsert({
        where: { roleId_accessId: { roleId: role.id, accessId: access.id } },
        update: {},
        create: { roleId: role.id, accessId: access.id },
      });
    }
  }
}

async function main() {
  console.log("🌱 Starting constants seed...");
  await seedConstants(prisma);
  console.log("🎉 Constants seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
