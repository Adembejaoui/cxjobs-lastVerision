import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";
import  prisma  from "@/lib/prisma";
import {
  candidateProfileSchema,
  companyProfileSchema,
  getCandidateOnboardingErrors,
  getCandidateRequiredFieldErrors,
  CandidateOnboardingIncompleteError,
  type ExperienceInput,
  type EducationInput,
  type LanguageInput,
  type SkillInput,
} from "@/lib/validations/profile";
import { logger } from "@/lib/logger";

type InteractiveTx = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

class ProfileRelationError extends Error {
  readonly relation: string;
  readonly ids: string[];
  constructor(relation: string, ids: string[]) {
    super(`Submitted ${relation} IDs do not belong to this candidate`);
    this.name = "ProfileRelationError";
    this.relation = relation;
    this.ids = ids;
  }
}

class DuplicateRelationIdError extends Error {
  readonly relation: string;
  readonly ids: string[];
  constructor(relation: string, ids: string[]) {
    super(`Submitted ${relation} IDs contain duplicates`);
    this.name = "DuplicateRelationIdError";
    this.relation = relation;
    this.ids = ids;
  }
}

type DateValue = string | Date | null | undefined;

/**
 * True when the client actually sent a relation list.
 *
 * The distinction the whole fix rests on is three-valued, not two:
 *   - `undefined` (key absent) / `null` -> NOT provided, leave rows alone
 *   - `[]`                            -> provided and empty, clear the relation
 *   - `[...]`                         -> provided, run ID-based synchronization
 *
 * Collapsing "absent" into "empty" is what used to delete a candidate's entire
 * experience history on a partial POST such as the CV upload's `{ resumeUrl }`.
 */
function isProvided<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null;
}

function toDate(value: DateValue): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const str = value.length === 7 ? `${value}-01` : value;
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  return null;
}

function sameInstant(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

function sameInstantNullable(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getTime() === b.getTime();
}

function classifyById<E extends { id: string }, S extends { id?: string | null }>(
  existing: E[],
  submitted: S[]
) {
  const submittedIds = new Set<string>();
  const newRows: S[] = [];
  for (const row of submitted) {
    if (row.id) {
      submittedIds.add(row.id);
    } else {
      newRows.push(row);
    }
  }
  const existingById = new Map<string, E>();
  for (const row of existing) {
    existingById.set(row.id, row);
  }
  const toUpdate: { existing: E; submitted: S }[] = [];
  const foreignIds: string[] = [];
  for (const row of submitted) {
    if (row.id) {
      const existingRow = existingById.get(row.id);
      if (existingRow) {
        toUpdate.push({ existing: existingRow, submitted: row });
      } else {
        foreignIds.push(row.id);
      }
    }
  }
  const toDelete = existing
    .filter((row) => !submittedIds.has(row.id))
    .map((row) => row.id);
  return { newRows, toUpdate, toDelete, foreignIds };
}

interface ExperienceWrite {
  title: string;
  company: string;
  location: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string;
}

interface ExperienceRecord {
  title: string;
  company: string;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
  description: string | null;
}

function normalizeExperience(exp: ExperienceInput): ExperienceWrite {
  return {
    title: exp.title,
    company: exp.company,
    location: exp.location || "",
    startDate: toDate(exp.startDate) ?? new Date(),
    endDate: toDate(exp.endDate) ?? null,
    isCurrent: exp.current || false,
    description: exp.description || "",
  };
}

function experienceEqual(existing: ExperienceRecord, normalized: ExperienceWrite): boolean {
  return (
    existing.title === normalized.title &&
    existing.company === normalized.company &&
    (existing.location ?? "") === normalized.location &&
    sameInstant(existing.startDate, normalized.startDate) &&
    sameInstantNullable(existing.endDate, normalized.endDate) &&
    existing.isCurrent === normalized.isCurrent &&
    (existing.description ?? "") === normalized.description
  );
}

async function syncExperiences(
  tx: InteractiveTx,
  candidateId: string,
  experiences: ExperienceInput[]
) {
  const existing = await tx.experience.findMany({ where: { candidateId } });
  const { newRows, toUpdate, toDelete, foreignIds } = classifyById(existing, experiences);

  if (foreignIds.length > 0) {
    throw new ProfileRelationError("experience", foreignIds);
  }

  if (toDelete.length > 0) {
    await tx.experience.deleteMany({ where: { id: { in: toDelete }, candidateId } });
  }

  for (const { existing: row, submitted: input } of toUpdate) {
    const normalized = normalizeExperience(input);
    if (!experienceEqual(row, normalized)) {
      await tx.experience.update({ where: { id: row.id, candidateId }, data: normalized });
    }
  }

  if (newRows.length > 0) {
    await tx.experience.createMany({
      data: newRows.map((input) => ({ candidateId, ...normalizeExperience(input) })),
    });
  }
}

interface EducationWrite {
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: Date;
  endDate: Date | null;
}

interface EducationRecord {
  school: string;
  degree: string;
  fieldOfStudy: string | null;
  startDate: Date;
  endDate: Date | null;
}

function normalizeEducation(edu: EducationInput): EducationWrite {
  return {
    school: edu.institution,
    degree: edu.degree,
    fieldOfStudy: edu.field || "",
    startDate: toDate(edu.startDate) ?? new Date(),
    endDate: toDate(edu.endDate) ?? null,
  };
}

function educationEqual(existing: EducationRecord, normalized: EducationWrite): boolean {
  return (
    existing.school === normalized.school &&
    existing.degree === normalized.degree &&
    (existing.fieldOfStudy ?? "") === normalized.fieldOfStudy &&
    sameInstant(existing.startDate, normalized.startDate) &&
    sameInstantNullable(existing.endDate, normalized.endDate)
  );
}

async function syncEducation(
  tx: InteractiveTx,
  candidateId: string,
  education: EducationInput[]
) {
  const existing = await tx.education.findMany({ where: { candidateId } });
  const { newRows, toUpdate, toDelete, foreignIds } = classifyById(existing, education);

  if (foreignIds.length > 0) {
    throw new ProfileRelationError("education", foreignIds);
  }

  if (toDelete.length > 0) {
    await tx.education.deleteMany({ where: { id: { in: toDelete }, candidateId } });
  }

  for (const { existing: row, submitted: input } of toUpdate) {
    const normalized = normalizeEducation(input);
    if (!educationEqual(row, normalized)) {
      await tx.education.update({ where: { id: row.id, candidateId }, data: normalized });
    }
  }

  if (newRows.length > 0) {
    await tx.education.createMany({
      data: newRows.map((input) => ({ candidateId, ...normalizeEducation(input) })),
    });
  }
}

interface LanguageWrite {
  name: string;
  proficiency: string;
}

interface LanguageRecord {
  name: string;
  proficiency: string;
}

function normalizeLanguage(lang: LanguageInput): LanguageWrite {
  return { name: lang.name, proficiency: lang.level || "BASIC" };
}

function languageEqual(existing: LanguageRecord, normalized: LanguageWrite): boolean {
  return existing.name === normalized.name && existing.proficiency === normalized.proficiency;
}

async function syncLanguages(
  tx: InteractiveTx,
  candidateId: string,
  languages: LanguageInput[]
) {
  const existing = await tx.language.findMany({ where: { candidateId } });
  const { newRows, toUpdate, toDelete, foreignIds } = classifyById(existing, languages);

  if (foreignIds.length > 0) {
    throw new ProfileRelationError("language", foreignIds);
  }

  if (toDelete.length > 0) {
    await tx.language.deleteMany({ where: { id: { in: toDelete }, candidateId } });
  }

  for (const { existing: row, submitted: input } of toUpdate) {
    const normalized = normalizeLanguage(input);
    if (!languageEqual(row, normalized)) {
      await tx.language.update({ where: { id: row.id, candidateId }, data: normalized });
    }
  }

  if (newRows.length > 0) {
    await tx.language.createMany({
      data: newRows.map((input) => ({ candidateId, ...normalizeLanguage(input) })),
      skipDuplicates: true,
    });
  }
}

interface SkillWrite {
  name: string;
  level: string | null;
}

interface SkillRecord {
  name: string;
  level: string | null;
}

function normalizeSkill(skill: SkillInput): SkillWrite {
  return { name: skill.name, level: skill.level ?? null };
}

function skillEqual(existing: SkillRecord, normalized: SkillWrite): boolean {
  return existing.name === normalized.name && existing.level === normalized.level;
}

async function syncSkills(
  tx: InteractiveTx,
  candidateId: string,
  skills: SkillInput[]
) {
  const existing = await tx.candidateSkill.findMany({ where: { candidateId } });
  const { newRows, toUpdate, toDelete, foreignIds } = classifyById(existing, skills);

  if (foreignIds.length > 0) {
    throw new ProfileRelationError("skill", foreignIds);
  }

  if (toDelete.length > 0) {
    await tx.candidateSkill.deleteMany({ where: { id: { in: toDelete }, candidateId } });
  }

  for (const { existing: row, submitted: input } of toUpdate) {
    const normalized = normalizeSkill(input);
    if (!skillEqual(row, normalized)) {
      await tx.candidateSkill.update({ where: { id: row.id, candidateId }, data: normalized });
    }
  }

  if (newRows.length > 0) {
    await tx.candidateSkill.createMany({
      data: newRows.map((input) => ({ candidateId, ...normalizeSkill(input) })),
      skipDuplicates: true,
    });
  }
}

type BenefitCategoryValue =
  | "HEALTH"
  | "FINANCIAL"
  | "WORK_ENVIRONMENT"
  | "CAREER_GROWTH"
  | "WORK_LIFE_BALANCE"
  | "OTHER";

type BenefitScopeValue = "CORE" | "ADDITIONAL";

interface BenefitFields {
  name: string;
  description: string | null;
  icon: string | null;
  category: BenefitCategoryValue;
  scope: BenefitScopeValue;
}

interface SubmittedBenefit {
  id?: string | null;
  name: string;
  description?: string | null;
  icon?: string | null;
  category?: BenefitCategoryValue;
  scope?: BenefitScopeValue;
}

function normalizeBenefit(submitted: SubmittedBenefit): BenefitFields {
  return {
    name: submitted.name,
    description: submitted.description ?? null,
    icon: submitted.icon ?? null,
    category: submitted.category ?? "OTHER",
    scope: submitted.scope ?? "ADDITIONAL",
  };
}

function benefitEqual(existing: BenefitFields, submitted: BenefitFields): boolean {
  return (
    existing.name === submitted.name &&
    (existing.description ?? "") === (submitted.description ?? "") &&
    (existing.icon ?? "") === (submitted.icon ?? "") &&
    existing.category === submitted.category &&
    existing.scope === submitted.scope
  );
}

/**
 * Reconciles the submitted benefit list against the company's existing rows.
 *
 * CompanyBenefit is referenced by JobOfferBenefit with onDelete: Cascade, so
 * deleting and recreating the whole list on every save destroyed each job's
 * per-job benefit selection and handed every benefit a new id. Synchronizing by
 * id instead keeps untouched rows — and their job links — completely intact.
 *
 * Ownership is the security boundary: `companyId` comes from the authenticated
 * user, is the only thing scoping the initial read, and is repeated on every
 * delete and update. A submitted id that is not in that company's existing set
 * is rejected rather than treated as a create, so a foreign id can never be
 * used to touch another company's data.
 */
async function syncCompanyBenefits(
  tx: InteractiveTx,
  companyId: string,
  submittedBenefits: SubmittedBenefit[]
) {
  const existing = await tx.companyBenefit.findMany({ where: { companyId } });
  const { newRows, toUpdate, toDelete, foreignIds } = classifyById(
    existing,
    submittedBenefits
  );

  // Reject before any write so the transaction rolls back untouched.
  if (foreignIds.length > 0) {
    throw new ProfileRelationError("companyBenefit", foreignIds);
  }

  // The same id twice would update the same row twice and the last write would
  // silently win, so refuse the payload instead.
  const seen = new Set<string>();
  const duplicateIds = submittedBenefits
    .map((benefit) => benefit.id)
    .filter((id): id is string => Boolean(id))
    .filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  if (duplicateIds.length > 0) {
    throw new DuplicateRelationIdError("companyBenefit", duplicateIds);
  }

  // Only benefits the user actually removed are deleted. Scoped by companyId as
  // well as id so a crafted payload cannot reach another company's rows.
  if (toDelete.length > 0) {
    await tx.companyBenefit.deleteMany({
      where: { id: { in: toDelete }, companyId },
    });
  }

  // Rows submitted without an id are new; the server assigns the UUIDs.
  if (newRows.length > 0) {
    await tx.companyBenefit.createMany({
      data: newRows.map((input) => ({
        companyId,
        ...normalizeBenefit(input),
      })),
    });
  }

  // Editable rows keep their id, and therefore their JobOfferBenefit links.
  for (const { existing: row, submitted: input } of toUpdate) {
    const normalized = normalizeBenefit(input);
    if (benefitEqual(row, normalized)) {
      continue;
    }
    await tx.companyBenefit.update({
      where: { id: row.id, companyId },
      data: normalized,
    });
  }
}

// GET /api/profile - Get current user's profile
export async function GET() {
  try {
    const authResult = await getAuthenticatedUser({ requireActive: true, requireOnboarded: true });
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: session } = authResult;

    const user = await prisma.user.findUnique({
      where: { id: session.id },
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
    const authResult = await getAuthenticatedUser({ requireActive: true });
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: session } = authResult;

    const body = await request.json();

    if (session.role === "CANDIDATE") {
      return await upsertCandidateProfile(session.id, body, session.isOnboarded);
    } else if (session.role === "COMPANY") {
      return await upsertCompanyProfile(session.id, body);
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid role for profile", code: "INVALID_ROLE" },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error("Update profile error", { error });
    if (error instanceof ProfileRelationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: "INVALID_RELATION_ID",
          details: { relation: error.relation, ids: error.ids },
        },
        { status: 400 }
      );
    }
    if (error instanceof DuplicateRelationIdError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: "DUPLICATE_RELATION_ID",
          details: { relation: error.relation, ids: error.ids },
        },
        { status: 400 }
      );
    }
    if (error instanceof CandidateOnboardingIncompleteError) {
      const errors = error.errors;
      return NextResponse.json(
        {
          success: false,
          error: errors[Object.keys(errors)[0]] ?? "Please complete your profile before finishing onboarding.",
          code: "VALIDATION_ERROR",
          details: errors,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to update profile", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

async function upsertCandidateProfile(userId: string, data: unknown, alreadyOnboarded: boolean) {
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

  // `candidateProfileSchema` strips unknown keys, so a client-supplied
  // `isOnboarded` never reaches the update below. Completion is decided by the
  // server alone.
  const { skills, experiences, languages, education, ...profileData } = validationResult.data;

  // Transform profileData to convert null to undefined for Prisma compatibility
  // Prisma's create input types don't accept null for array fields or boolean
  const cleanedProfileData = {
    ...profileData,
    preferredJobTypes: profileData.preferredJobTypes === null ? undefined : profileData.preferredJobTypes,
  };

  // Use transaction to ensure atomicity for writes
  const candidateId = await prisma.$transaction(async (tx: InteractiveTx) => {
    // Create or update candidate profile
    // Create or update candidate profile. Only existence matters here; the
    // state that the completion check below reads is fetched separately, after
    // the relation syncs, so it can never be stale.
    const existingCandidate = await tx.candidate.findUnique({
      where: { userId },
      select: { id: true },
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
    } else {
      candidate = await tx.candidate.create({
        data: {
          userId,
          ...cleanedProfileData,
        },
      });
    }

    // Partial-update semantics: only a relation the client actually sent is
    // reconciled. An omitted (or explicitly null) key means "leave this relation
    // alone", so a partial POST such as the CV upload's `{ resumeUrl }` cannot
    // wipe the candidate's experiences, education, languages or skills. An
    // explicit `[]` is still honoured and clears that relation, and a supplied
    // list still goes through the ID-based sync in classifyById, so a foreign ID
    // remains an INVALID_RELATION_ID and ownership is unchanged.
    if (isProvided(experiences)) {
      await syncExperiences(tx, candidate.id, experiences);
    }
    if (isProvided(education)) {
      await syncEducation(tx, candidate.id, education);
    }
    if (isProvided(languages)) {
      await syncLanguages(tx, candidate.id, languages);
    }
    if (isProvided(skills)) {
      await syncSkills(tx, candidate.id, skills);
    }

    // The FINAL state is read back from the database inside this transaction,
    // never assembled from the request body. Since the syncs above have already
    // run, these reads see exactly what a later request would observe, so an
    // omitted relation is judged by the rows that are still persisted rather
    // than by a phantom empty list. The onboarding requirements can therefore
    // never be satisfied by a payload that omits a relation it has not filled
    // in, and a candidate whose relations were genuinely wiped still fails.
    const finalState = await tx.candidate.findUnique({
      where: { userId },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        location: true,
        targetJobRole: true,
        gender: true,
        dateOfBirth: true,
        skills: { select: { name: true } },
        languages: { select: { name: true } },
        experiences: { select: { title: true, company: true } },
        education: { select: { school: true, degree: true } },
      },
    });

    // Gender and date of birth are required for EVERY candidate profile save.
    const requiredErrors = getCandidateRequiredFieldErrors(finalState);

    // The remaining onboarding fields are only required while completing
    // onboarding; once onboarded a POST is an ordinary profile edit.
    const onboardingErrors = alreadyOnboarded
      ? {}
      : getCandidateOnboardingErrors(finalState);

    const blockingErrors = { ...onboardingErrors, ...requiredErrors };
    if (Object.keys(blockingErrors).length > 0) {
      // Throwing rolls the candidate upsert and the relation syncs back, so a
      // rejected save never leaves a half-written or half-onboarded profile.
      throw new CandidateOnboardingIncompleteError(blockingErrors);
    }

    // Mark user as onboarded
    await tx.user.update({
      where: { id: userId },
      data: { isOnboarded: true },
    });

    return candidate.id;
  });

  // Read candidate with relations after transaction commits
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      skills: true,
      experiences: { orderBy: { startDate: "desc" } },
      languages: true,
      education: { orderBy: { startDate: "desc" } },
    },
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
    select: { id: true },
  });

  if (existingSlug) {
    return NextResponse.json(
      { success: false, error: "This slug is already taken", code: "SLUG_TAKEN" },
      { status: 400 }
    );
  }

  // Validate emailCompany uniqueness against User.email if provided
  if (profileData.emailCompany !== undefined && profileData.emailCompany !== null) {
    const normalizedEmailCompany = profileData.emailCompany.trim().toLowerCase();
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
    // Normalize emailCompany for storage
    profileData.emailCompany = normalizedEmailCompany;
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
      emailCompany: profileData.emailCompany || null,
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

    // Benefits are reconciled by id so that benefits the user did not touch keep
    // their rows, and with them the JobOfferBenefit links pointing at them.
    // Omitted `benefits` keeps its existing meaning of "empty list".
    await syncCompanyBenefits(tx, company.id, benefits ?? []);

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
