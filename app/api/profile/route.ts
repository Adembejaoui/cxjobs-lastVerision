import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import  prisma  from "@/lib/prisma";
import { candidateProfileSchema, companyProfileSchema } from "@/lib/validations/profile";
import { logger } from "@/lib/logger";

type InteractiveTx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        isOnboarded: true,
        createdAt: true,
        candidate: {
          include: {
            skills: true,
            experiences: { orderBy: { startDate: "desc" } },
            languages: true,
            education: { orderBy: { startDate: "desc" } },
          },
        },
        companies: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error("Get profile error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST /api/profile - Create or update profile
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (user.role === "CANDIDATE") {
      return await upsertCandidateProfile(session.user.id, body);
    } else if (user.role === "COMPANY") {
      return await upsertCompanyProfile(session.user.id, body);
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid role for profile", code: "INVALID_ROLE" },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error("Update profile error", { error });
    return NextResponse.json(
      { success: false, error: "Failed to update profile", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

async function upsertCandidateProfile(userId: string, data: unknown) {
  const validationResult = candidateProfileSchema.safeParse(data);

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

  const { skills, experiences, languages, education, ...profileData } = validationResult.data;

  // Transform profileData to convert null to undefined for Prisma compatibility
  // Prisma's create input types don't accept null for array fields or boolean
  const cleanedProfileData = {
    ...profileData,
    preferredJobTypes: profileData.preferredJobTypes === null ? undefined : profileData.preferredJobTypes,
  };

  // Use transaction to ensure atomicity
  const candidate = await prisma.$transaction(async (tx: InteractiveTx) => {
    // Create or update candidate profile
    const existingCandidate = await tx.candidate.findUnique({
      where: { userId },
    });

    let candidate;
    if (existingCandidate) {
      candidate = await tx.candidate.update({
        where: { userId },
        data: {
          ...cleanedProfileData,
          updatedAt: new Date(),
        },
      });

      // Delete existing related data
      await tx.candidateSkill.deleteMany({ where: { candidateId: candidate.id } });
      await tx.experience.deleteMany({ where: { candidateId: candidate.id } });
      await tx.language.deleteMany({ where: { candidateId: candidate.id } });
      await tx.education.deleteMany({ where: { candidateId: candidate.id } });
    } else {
      candidate = await tx.candidate.create({
        data: {
          userId,
          ...cleanedProfileData,
        },
      });
    }

    // Create new related data
    if (skills && skills.length > 0) {
      await tx.candidateSkill.createMany({
        data: skills.map((skill: { name: string; level?: string }) => ({
          candidateId: candidate.id,
          name: skill.name,
          level: skill.level,
        })),
        skipDuplicates: true,
      });
    }

    if (experiences && experiences.length > 0) {
      await tx.experience.createMany({
        data: experiences.map((exp: { title: string; company: string; location?: string; startDate: string | Date; endDate?: string | Date | null; current?: boolean; description?: string }) => {
          // Handle dates - handle both string and Date types from Zod
          let startDateStr: string | undefined;
          let endDateStr: string | undefined;
          
          // Process startDate
          if (typeof exp.startDate === 'string') {
            startDateStr = exp.startDate.length === 7 ? exp.startDate + "-01" : exp.startDate;
          } else if (exp.startDate instanceof Date) {
            startDateStr = exp.startDate.toISOString();
          }
          
          // Process endDate
          if (typeof exp.endDate === 'string') {
            endDateStr = exp.endDate?.length === 7 ? exp.endDate + "-01" : exp.endDate || undefined;
          } else if (exp.endDate instanceof Date) {
            endDateStr = exp.endDate.toISOString();
          }
          
          return {
            candidateId: candidate.id,
            title: exp.title,
            company: exp.company,
            location: exp.location || "",
            startDate: startDateStr ? new Date(startDateStr) : new Date(),
            endDate: endDateStr ? new Date(endDateStr) : null,
            isCurrent: exp.current || false,
            description: exp.description || "",
          };
        }),
      });
    }

    if (languages && languages.length > 0) {
      await tx.language.createMany({
        data: languages.map((lang: { name: string; level?: string }) => ({
          candidateId: candidate.id,
          name: lang.name,
          proficiency: lang.level || "BASIC",
        })),
        skipDuplicates: true,
      });
    }

    if (education && education.length > 0) {
      await tx.education.createMany({
        data: education.map((edu: { institution: string; degree: string; field?: string; startDate: string | Date; endDate?: string | Date | null }) => {
          // Handle dates - handle both string and Date types from Zod
          let startDateStr: string | undefined;
          let endDateStr: string | undefined;
          
          // Process startDate
          if (typeof edu.startDate === 'string') {
            startDateStr = edu.startDate.length === 7 ? edu.startDate + "-01" : edu.startDate;
          } else if (edu.startDate instanceof Date) {
            startDateStr = edu.startDate.toISOString();
          }
          
          // Process endDate
          if (typeof edu.endDate === 'string') {
            endDateStr = edu.endDate?.length === 7 ? edu.endDate + "-01" : edu.endDate || undefined;
          } else if (edu.endDate instanceof Date) {
            endDateStr = edu.endDate.toISOString();
          }
          
          return {
            candidateId: candidate.id,
            school: edu.institution,
            degree: edu.degree,
            fieldOfStudy: edu.field || "",
            startDate: startDateStr ? new Date(startDateStr) : new Date(),
            endDate: endDateStr ? new Date(endDateStr) : null,
          };
        }),
      });
    }

    // Mark user as onboarded
    await tx.user.update({
      where: { id: userId },
      data: { isOnboarded: true },
    });

    return tx.candidate.findUnique({
      where: { id: candidate.id },
      include: {
        skills: true,
        experiences: { orderBy: { startDate: "desc" } },
        languages: true,
        education: { orderBy: { startDate: "desc" } },
      },
    });
  });

  return NextResponse.json({
    success: true,
    message: "Profile updated successfully",
    data: candidate,
  });
}

async function upsertCompanyProfile(userId: string, data: unknown) {
  const validationResult = companyProfileSchema.safeParse(data);

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

  const { slug, benefits, culture, ...profileData } = validationResult.data;

  // Check if slug is already taken by another company
  const existingSlug = await prisma.companies.findFirst({
    where: {
      slug,
      NOT: { userId },
    },
  });

  if (existingSlug) {
    return NextResponse.json(
      { success: false, error: "This slug is already taken", code: "SLUG_TAKEN" },
      { status: 400 }
    );
  }

  // Transform culture array to JSON string for storage
  const cultureJson = culture && culture.length > 0 ? JSON.stringify(culture) : null;

    // Build company data object with properly typed fields
    const companyData = {
      name: profileData.name!,
      description: profileData.description || null,
      logoUrl: profileData.logoUrl || null,
      coverImageUrl: profileData.coverImageUrl || null,
      website: profileData.website || null,
      linkedinUrl: profileData.linkedinUrl || null,
      twitterUrl: profileData.twitterUrl || null,
      facebookUrl: profileData.facebookUrl || null,
      companySize: profileData.companySize || null,
      location: profileData.location || null,
      foundedYear: profileData.foundedYear || null,
      isRemoteFriendly: profileData.isRemoteFriendly ?? false,
      isHybridFriendly: profileData.isHybridFriendly ?? false,
      culture: cultureJson,
    };

  const company = await prisma.$transaction(async (tx: InteractiveTx) => {
    const existingCompany = await tx.companies.findUnique({
      where: { userId },
    });

    let company;
    if (existingCompany) {
      company = await tx.companies.update({
        where: { userId },
        data: {
          ...companyData,
          slug,
          updatedAt: new Date(),
        },
      });
    } else {
      company = await tx.companies.create({
        data: {
          userId,
          ...companyData,
          slug,
        },
      });
    }

    // Handle benefits - delete existing and create new ones
    if (benefits && benefits.length > 0) {
      // Delete all existing benefits for this company
      await tx.companyBenefit.deleteMany({
        where: { companyId: company.id },
      });

      // Create new benefits
      await tx.companyBenefit.createMany({
        data: benefits.map((b: { name: string; description?: string | null; icon?: string | null; category?: "HEALTH" | "FINANCIAL" | "WORK_ENVIRONMENT" | "CAREER_GROWTH" | "WORK_LIFE_BALANCE" | "OTHER"; scope?: "CORE" | "ADDITIONAL" }) => ({
          companyId: company.id,
          name: b.name,
          description: b.description || null,
          icon: b.icon || null,
          category: b.category || "OTHER",
          scope: b.scope || "ADDITIONAL",
        })),
      });
    } else {
      // If no benefits provided, optionally clear existing
      await tx.companyBenefit.deleteMany({
        where: { companyId: company.id },
      });
    }

    // Mark user as onboarded
    await tx.user.update({
      where: { id: userId },
      data: { isOnboarded: true },
    });

    // Return company with benefits
    return tx.companies.findUnique({
      where: { id: company.id },
      include: { benefits: true },
    });
  });

  return NextResponse.json({
    success: true,
    message: "Company profile updated successfully",
    data: company,
  });
}
