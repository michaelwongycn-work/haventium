import { del } from "@vercel/blob";
import {
  requireAccess,
  handleApiError,
  ActivityLogger,
  apiSuccess,
  apiNotFound,
  logger,
  DOCUMENT_WITH_RELATIONS,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";

// GET /api/documents/[id] - Get single document
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "documents",
      "read",
    );
    if (!authorized) return response;

    const { id } = await params;

    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      ...DOCUMENT_WITH_RELATIONS,
    });

    if (!document) {
      return apiNotFound("Document not found");
    }

    return apiSuccess(document);
  } catch (error) {
    return handleApiError(error, "fetch document");
  }
}

// DELETE /api/documents/[id] - Delete document
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { authorized, response, session } = await requireAccess(
      "documents",
      "delete",
    );
    if (!authorized) return response;

    const { id } = await params;

    // Verify document belongs to organization
    const existingDocument = await prisma.document.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingDocument) {
      return apiNotFound("Document not found");
    }

    // Determine entity type for activity logging
    let entityType = "unknown";
    if (existingDocument.leaseId) entityType = "lease";
    else if (existingDocument.tenantId) entityType = "tenant";
    else if (existingDocument.unitId) entityType = "unit";
    else if (existingDocument.propertyId) entityType = "property";

    // Log activity before deletion
    await ActivityLogger.documentDeleted(
      session,
      {
        id: existingDocument.id,
        filename: existingDocument.filename,
      },
      {
        entityType,
        propertyId: existingDocument.propertyId ?? undefined,
        unitId: existingDocument.unitId ?? undefined,
        tenantId: existingDocument.tenantId ?? undefined,
        leaseId: existingDocument.leaseId ?? undefined,
      },
    );

    // Delete from Vercel Blob
    try {
      await del(existingDocument.storageKey);
    } catch (error) {
      // Log but don't fail - file might already be deleted
      logger.warn("Failed to delete file from blob storage");
    }

    // Delete from database (activities will be set to null via onDelete: SetNull)
    await prisma.document.delete({
      where: { id },
    });

    return apiSuccess({ message: "Document deleted successfully" });
  } catch (error) {
    return handleApiError(error, "delete document");
  }
}
