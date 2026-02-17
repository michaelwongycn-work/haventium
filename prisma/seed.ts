import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import "dotenv/config"

const connectionString = `${process.env.DATABASE_URL}`

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 Starting seed...")

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

  for (const accessData of defaultAccesses) {
    await prisma.access.upsert({
      where: {
        resource_action: {
          resource: accessData.resource,
          action: accessData.action,
        },
      },
      update: {},
      create: accessData,
    })
  }
  console.log("✓ Created default accesses")

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
