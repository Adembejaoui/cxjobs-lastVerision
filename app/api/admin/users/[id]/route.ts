import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { adminUpdateUserWithCompanySchema } from "@/lib/validations/auth";
import { logger } from "@/lib/logger";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdmin();

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Validate with the combined schema that allows optional company data
    const validationResult = adminUpdateUserWithCompanySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Fetch the target user with only the fields needed for authorization.
    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        email: true,
        name: true,
        isActive: true,
        companies: {
          select: { id: true },
        },
      },
    });

    if (!target) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Admins cannot manage other admin accounts.
    if (target.role === "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Admin accounts cannot be modified", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // Company profile fields are only valid for COMPANY role users.
    // Reject the payload explicitly rather than silently dropping it, so a
    // client mistake surfaces as a 400 instead of a confusing no-op.
    if (updates.company !== undefined && target.role !== "COMPANY") {
      return NextResponse.json(
        {
          success: false,
          error: "Company profile fields can only be updated for COMPANY role users.",
          code: "BAD_REQUEST",
        },
        { status: 400 }
      );
    }

    // Build an explicit, allow-listed update payload for user fields.
    // role and passwordHash are deliberately excluded from the schema and therefore can never be supplied.
    const userData: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      userData.name = updates.name;
    }

    if (updates.email !== undefined) {
      const normalizedEmail = updates.email.trim().toLowerCase();
      userData.email = normalizedEmail;
    }

    if (updates.isActive !== undefined) {
      userData.isActive = updates.isActive;
    }

    // Prepare company data if the user is a COMPANY and company updates are provided
    const isCompany = target.role === "COMPANY";
    const companyData = isCompany && updates.company ? updates.company : undefined;

    // Check if there's anything to update
    const hasUserUpdates = Object.keys(userData).length > 0;
    const hasCompanyUpdates = companyData && Object.keys(companyData).length > 0;

    if (!hasUserUpdates && !hasCompanyUpdates) {
      return NextResponse.json(
        { success: false, error: "No fields to update", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // Enforce email uniqueness across the whole table (case-insensitive).
    if (userData.email !== undefined) {
      const existing = await prisma.user.findFirst({
        where: {
          email: { equals: userData.email as string, mode: "insensitive" },
          id: { not: id },
        },
        select: { id: true },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: "Email already in use", code: "EMAIL_IN_USE" },
          { status: 409 }
        );
      }
    }

    // If company emailCompany is being updated, enforce uniqueness against User.email
    if (companyData?.emailCompany !== undefined) {
      const normalizedEmailCompany = (companyData.emailCompany as string).trim().toLowerCase();
      
      // Check if there's an existing company to compare against
      const existingCompany = await prisma.companies.findUnique({
        where: { userId: id },
        select: { emailCompany: true },
      });

      // Only check if the email is actually changing
      if (!existingCompany || existingCompany.emailCompany !== normalizedEmailCompany) {
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmailCompany },
          select: { id: true },
        });

        if (existingUser) {
          return NextResponse.json(
            {
              success: false,
              error: "This company email is already associated with a user account.",
              code: "COMPANY_EMAIL_IN_USE",
            },
            { status: 409 }
          );
}
  }

  // Normalize emailCompany for storage
  companyData.emailCompany = normalizedEmailCompany;
}

// If company slug is being updated, enforce uniqueness
if (companyData?.slug !== undefined) {
  const existingCompanySlug = await prisma.companies.findFirst({
    where: {
      slug: { equals: companyData.slug, mode: "insensitive" },
      userId: { not: id },
    },
    select: { id: true },
  });

  if (existingCompanySlug) {
    return NextResponse.json(
      { success: false, error: "Company slug already in use", code: "SLUG_IN_USE" },
      { status: 409 }
    );
  }
}

// Build company update data with explicit allow-list
    const companyUpdateData: Record<string, unknown> = {};
    if (hasCompanyUpdates) {
      const allowedCompanyFields = [
        "name",
        "slug",
        "logoUrl",
        "coverImageUrl",
        "companySize",
        "location",
        "website",
        "foundedYear",
        "description",
        "isRemoteFriendly",
        "isHybridFriendly",
        "linkedinUrl",
        "twitterUrl",
        "facebookUrl",
        "isVerified",
        "emailCompany",
      ];

      for (const field of allowedCompanyFields) {
        if (companyData && companyData[field as keyof typeof companyData] !== undefined) {
          companyUpdateData[field] = companyData[field as keyof typeof companyData];
        }
      }
    }

    // Execute updates in a transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      let updatedUser = null;
      let updatedCompany = null;

      // Update user if needed
      if (hasUserUpdates) {
        updatedUser = await tx.user.update({
          where: { id },
          data: userData,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });
      } else {
        // Fetch user data if not updated
        updatedUser = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });
      }

      // Update company if needed
      if (hasCompanyUpdates && target.companies?.id) {
        updatedCompany = await tx.companies.update({
          where: { userId: id },
          data: companyUpdateData,
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            coverImageUrl: true,
            companySize: true,
            location: true,
            website: true,
            foundedYear: true,
            description: true,
            isRemoteFriendly: true,
            isHybridFriendly: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      return { user: updatedUser, company: updatedCompany };
    });

    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      data: result.user,
      company: result.company,
    });
  } catch (error) {
    logger.error("Failed to update admin user", { error });
    return NextResponse.json(
      { success: false, error: "Failed to update user", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}