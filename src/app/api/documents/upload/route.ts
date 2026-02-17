import { put } from "@vercel/blob";
import {
  requireAccess,
  handleApiError,
  ActivityLogger,
  apiCreated,
  apiError,
  apiNotFound,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed file types
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// POST /api/documents/upload - Upload a document
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAccess(
      "documents",
      "create",
    );
    if (!authorized) return response;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;

    if (!file) {
      return apiError("No file provided", 400);
    }

    if (!entityType || !entityId) {
      return apiError("Entity type and ID are required", 400);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError("File size exceeds 10MB limit", 400);
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return apiError(
        "Invalid file type. Only PDF and images are allowed.",
        400,
      );
    }

    // Validate entity exists and belongs to organization
    let propertyId: string | undefined;
    let unitId: string | undefined;
    let tenantId: string | undefined;
    let leaseId: string | undefined;

    switch (entityType) {
      case "property": {
        const property = await prisma.property.findFirst({
          where: {
            id: entityId,
            organizationId: session.user.organizationId,
          },
        });
        if (!property) {
          return apiNotFound("Property not found");
        }
        propertyId = entityId;
        break;
      }

      case "unit": {
        const unit = await prisma.unit.findFirst({
          where: {
            id: entityId,
          },
          include: {
            property: true,
          },
        });
        if (!unit || unit.property.organizationId !== session.user.organizationId) {
          return apiNotFound("Unit not found");
        }
        unitId = entityId;
        propertyId = unit.propertyId;
        break;
      }

      case "tenant": {
        const tenant = await prisma.tenant.findFirst({
          where: {
            id: entityId,
            organizationId: session.user.organizationId,
          },
        });
        if (!tenant) {
          return apiNotFound("Tenant not found");
        }
        tenantId = entityId;
        break;
      }

      case "lease": {
        const lease = await prisma.leaseAgreement.findFirst({
          where: {
            id: entityId,
            organizationId: session.user.organizationId,
          },
          include: {
            unit: true,
            tenant: true,
          },
        });
        if (!lease) {
          return apiNotFound("Lease not found");
        }
        leaseId = entityId;
        propertyId = lease.unit.propertyId;
        unitId = lease.unitId;
        tenantId = lease.tenantId;
        break;
      }

      default:
        return apiError("Invalid entity type", 400);
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: "public",
      addRandomSuffix: true,
    });

    // Save to database
    const document = await prisma.document.create({
      data: {
        organizationId: session.user.organizationId,
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: blob.url,
        storageKey: blob.pathname,
        propertyId,
        unitId,
        tenantId,
        leaseId,
      },
      include: {
        property: true,
        unit: true,
        tenant: true,
        lease: true,
      },
    });

    // Log activity
    await ActivityLogger.documentUploaded(
      session,
      {
        id: document.id,
        filename: document.filename,
      },
      {
        entityType,
        entityId,
        propertyId,
        unitId,
        tenantId,
        leaseId,
      },
    );

    return apiCreated(document);
  } catch (error) {
    return handleApiError(error, "upload document");
  }
}
