import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import prisma from "@/lib/prisma";
import { adminUpdateUserWithCompanySchema } from "@/lib/validations/auth";
import { logger } from "@/lib/logger";
import { revalidateJobOffers, revalidateCompanies } from "@/lib/cache";
import { isCompanySlugAvailable, recordCompanySlugChange } from "@/lib/server/company-slug";
import { bumpSessionVersion, publishSessionVersion } from "@/lib/server/session-revocation";
import { emailIsTaken, normalizeEmail, type EmailLookupDb } from "@/lib/server/user-email";

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
          select: { id: true, slug: true },
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
        if (await emailIsTaken(prisma.user as unknown as EmailLookupDb<{ email: string }>, normalizedEmailCompany)) {
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
  // Taken by another company now, or formerly (its old links redirect
  // there: launch plan A6).
  const slugFree = await isCompanySlugAvailable(prisma, String(companyData.slug), target.companies?.id ?? null);

  if (!slugFree) {
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
    let revokedVersion: number | null = null;
    const result = await prisma.$transaction(async (tx) => {
      let updatedUser = null;
      let updatedCompany = null;

      // Suspension or an identity (email) change signs the user out of every
      // existing session, atomically with the change itself.
      const emailChanged = userData.email !== undefined && userData.email !== target.email;
      if (userData.isActive === false || emailChanged) {
        revokedVersion = await bumpSessionVersion(tx, id);
      }

      // A NEW address (not merely a case normalization of the old one) is not
      // proven to belong to the user, and links already mailed to the OLD
      // address must stop working: a reset link would otherwise let the old
      // mailbox owner take over the account for up to an hour (NF-15).
      const addressChanged =
        userData.email !== undefined && userData.email !== normalizeEmail(target.email);
      if (addressChanged) {
        userData.emailVerified = null;
        await tx.passwordResetToken.deleteMany({ where: { userId: id } });
        await tx.emailVerificationToken.deleteMany({ where: { userId: id } });
      }

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
        if (target.companies.slug !== updatedCompany.slug) {
          await recordCompanySlugChange(tx, target.companies.id, target.companies.slug, updatedCompany.slug);
        }
      }

      return { user: updatedUser, company: updatedCompany };
    });

    // F-04: suspending or reactivating a company changes what is public
    // (catalogue, job pages, company pages and listings). Targeted
    // invalidation of exactly those caches, after the commit.
    // A6: an admin edit of the public company profile is visible at once too.
    if (
      (target.role === "COMPANY" && updates.isActive !== undefined && updates.isActive !== target.isActive) ||
      result.company
    ) {
      revalidateJobOffers();
      revalidateCompanies();
    }

    if (revokedVersion !== null) {
      await publishSessionVersion(id, revokedVersion);
    }

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