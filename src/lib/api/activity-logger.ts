import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import { logger } from "@/lib/logger";

/**
 * Activity Logger Service
 * Centralized activity logging for all API operations
 */

export type ActivityType =
  | "TENANT_CREATED"
  | "TENANT_UPDATED"
  | "TENANT_STATUS_CHANGED"
  | "PROPERTY_CREATED"
  | "PROPERTY_UPDATED"
  | "UNIT_CREATED"
  | "UNIT_UPDATED"
  | "LEASE_CREATED"
  | "LEASE_UPDATED"
  | "LEASE_TERMINATED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_UPDATED"
  | "DEPOSIT_CREATED"
  | "DEPOSIT_RETURNED"
  | "NOTIFICATION_SENT"
  | "API_KEY_CREATED"
  | "API_KEY_UPDATED"
  | "API_KEY_DELETED"
  | "USER_LOGIN"
  | "OTHER";

export interface ActivityLogData {
  type: ActivityType;
  description: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseId?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(
  session: Session,
  data: ActivityLogData,
): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        type: data.type,
        description: data.description,
        userId: session.user.id,
        organizationId: session.user.organizationId,
        tenantId: data.tenantId,
        propertyId: data.propertyId,
        unitId: data.unitId,
        leaseId: data.leaseId,
      },
    });
  } catch (error) {
    // Log but don't throw - activity logging shouldn't break the main operation
    logger.error("Failed to log activity", error, {
      userId: session.user.id,
      organizationId: session.user.organizationId,
      activityType: data.type,
    });
  }
}

/**
 * Convenience methods for common activities
 */

export const ActivityLogger = {
  tenantCreated: (
    session: Session,
    tenant: { id: string; fullName: string; email: string },
  ) =>
    logActivity(session, {
      type: "TENANT_CREATED",
      description: `Created tenant: ${tenant.fullName} (${tenant.email})`,
      tenantId: tenant.id,
    }),

  tenantUpdated: (session: Session, tenant: { id: string; fullName: string }) =>
    logActivity(session, {
      type: "TENANT_UPDATED",
      description: `Updated tenant: ${tenant.fullName}`,
      tenantId: tenant.id,
    }),

  propertyCreated: (session: Session, property: { id: string; name: string }) =>
    logActivity(session, {
      type: "PROPERTY_CREATED",
      description: `Created property: ${property.name}`,
      propertyId: property.id,
    }),

  propertyUpdated: (session: Session, property: { id: string; name: string }) =>
    logActivity(session, {
      type: "PROPERTY_UPDATED",
      description: `Updated property: ${property.name}`,
      propertyId: property.id,
    }),

  unitCreated: (
    session: Session,
    unit: { id: string; name: string; propertyId: string },
    propertyName: string,
  ) =>
    logActivity(session, {
      type: "UNIT_CREATED",
      description: `Created unit: ${propertyName} - ${unit.name}`,
      unitId: unit.id,
      propertyId: unit.propertyId,
    }),

  unitUpdated: (
    session: Session,
    unit: { id: string; name: string; propertyId: string },
    propertyName: string,
  ) =>
    logActivity(session, {
      type: "UNIT_UPDATED",
      description: `Updated unit: ${propertyName} - ${unit.name}`,
      unitId: unit.id,
      propertyId: unit.propertyId,
    }),

  leaseCreated: (
    session: Session,
    lease: {
      id: string;
      tenantId: string;
      unitId: string;
    },
    details: {
      tenantName: string;
      propertyName: string;
      unitName: string;
      propertyId: string;
    },
  ) =>
    logActivity(session, {
      type: "LEASE_CREATED",
      description: `Created lease agreement for ${details.tenantName} at ${details.propertyName} - ${details.unitName}`,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      propertyId: details.propertyId,
    }),

  leaseUpdated: (
    session: Session,
    lease: {
      id: string;
      tenantId: string;
      unitId: string;
    },
    details: {
      tenantName: string;
      propertyName: string;
      unitName: string;
      propertyId: string;
    },
  ) =>
    logActivity(session, {
      type: "LEASE_UPDATED",
      description: `Updated lease agreement for ${details.tenantName} at ${details.propertyName} - ${details.unitName}`,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      propertyId: details.propertyId,
    }),

  leaseTerminated: (
    session: Session,
    lease: {
      id: string;
      tenantId: string;
      unitId: string;
    },
    details: {
      tenantName: string;
      propertyName: string;
      unitName: string;
      propertyId: string;
    },
  ) =>
    logActivity(session, {
      type: "LEASE_TERMINATED",
      description: `Terminated lease for ${details.tenantName} at ${details.propertyName} - ${details.unitName}`,
      leaseId: lease.id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      propertyId: details.propertyId,
    }),

  userInvited: (session: Session, user: { name: string; email: string }) =>
    logActivity(session, {
      type: "OTHER",
      description: `Invited user: ${user.name} (${user.email})`,
    }),

  userUpdated: (session: Session, user: { name: string }) =>
    logActivity(session, {
      type: "OTHER",
      description: `Updated user: ${user.name}`,
    }),

  userDeleted: (session: Session, user: { name: string; email: string }) =>
    logActivity(session, {
      type: "OTHER",
      description: `Deleted user: ${user.name} (${user.email})`,
    }),
};
