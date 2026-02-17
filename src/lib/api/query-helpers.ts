import { prisma } from "@/lib/prisma";

/**
 * Reusable Prisma Query Fragments
 * Common select and include patterns
 */

export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  userRoles: {
    include: {
      role: true,
    },
  },
} as const;

export const TENANT_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  preferEmail: true,
  preferWhatsapp: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const PROPERTY_WITH_UNITS = {
  include: {
    _count: {
      select: {
        units: true,
      },
    },
  },
} as const;

export const UNIT_WITH_PROPERTY = {
  include: {
    property: true,
  },
} as const;

export const LEASE_WITH_RELATIONS = {
  include: {
    tenant: true,
    unit: {
      include: {
        property: true,
      },
    },
  },
} as const;

/**
 * Organization-scoped query helpers
 */

export function scopeToOrganization<T extends Record<string, any>>(
  where: T,
  organizationId: string,
): T & { organizationId: string } {
  return {
    ...where,
    organizationId,
  };
}

export function scopeToOrganizationViaRelation<T extends Record<string, any>>(
  where: T,
  organizationId: string,
  relation: string,
): T {
  return {
    ...where,
    [relation]: {
      organizationId,
    },
  };
}

/**
 * Common query builders
 */

export async function findUserInOrganization(
  userId: string,
  organizationId: string,
) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      organizationId,
    },
    select: USER_SELECT,
  });
}

export async function findTenantInOrganization(
  tenantId: string,
  organizationId: string,
) {
  return prisma.tenant.findFirst({
    where: {
      id: tenantId,
      organizationId,
    },
  });
}

export async function findPropertyInOrganization(
  propertyId: string,
  organizationId: string,
) {
  return prisma.property.findFirst({
    where: {
      id: propertyId,
      organizationId,
    },
  });
}

export async function findUnitInOrganization(
  unitId: string,
  organizationId: string,
) {
  return prisma.unit.findFirst({
    where: {
      id: unitId,
      property: {
        organizationId,
      },
    },
    include: {
      property: true,
    },
  });
}

export async function findLeaseInOrganization(
  leaseId: string,
  organizationId: string,
) {
  return prisma.leaseAgreement.findFirst({
    where: {
      id: leaseId,
      organizationId,
    },
    ...LEASE_WITH_RELATIONS,
  });
}
