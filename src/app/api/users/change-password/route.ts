import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  comparePassword,
  hashPassword,
  validatePassword,
} from "@/lib/password";
import {
  requireAuth,
  apiSuccess,
  apiNotFound,
  apiError,
  handleApiError,
  validateRequest,
} from "@/lib/api";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// POST /api/users/change-password - Change own password
export async function POST(request: Request) {
  try {
    const { authorized, response, session } = await requireAuth();
    if (!authorized || !session) return response;

    const validatedData = await validateRequest(request, changePasswordSchema);

    // Fetch user with hashed password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.hashedPassword) {
      return apiNotFound("User not found");
    }

    // Verify current password
    const isValidPassword = await comparePassword(
      validatedData.currentPassword,
      user.hashedPassword,
    );

    if (!isValidPassword) {
      return apiError("Current password is incorrect", 400);
    }

    // Validate new password strength
    const passwordValidation = validatePassword(validatedData.newPassword);
    if (!passwordValidation.valid) {
      return apiError(passwordValidation.errors[0], 400);
    }

    // Hash and update
    const hashedPw = await hashPassword(validatedData.newPassword);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { hashedPassword: hashedPw },
    });

    return apiSuccess({ success: true });
  } catch (error) {
    return handleApiError(error, "change password");
  }
}
