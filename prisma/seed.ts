/**
 * CXJobs — dedicated K6 performance-test database seed.
 *
 * Scope: DATABASE SEEDING ONLY. This file never calls HTTP endpoints, never
 * calls `prisma migrate reset`, and never touches the application seed,
 * Prisma schema/migrations, routes, or authentication.
 *
 * Dataset (deterministic and rerunnable):
 *   - 105 users  : 100 CANDIDATE (user1@gmail.com .. user100@gmail.com)
 *                  +   5 COMPANY   (company1@cxjobs.test .. company5@cxjobs.test)
 *   - 100 Candidate profiles, each satisfying the CURRENT onboarding rules in
 *     lib/validations/profile.ts (firstName, lastName, phone, location,
 *     targetJobRole, >=1 named skill, gender in {Male, Female}, valid
 *     dateOfBirth, plus languages/experience/education for the roles that
 *     require them) and carrying >=3 skills, >=1 experience, >=1 education and
 *     >=1 language.
 *   -   5 Company profiles, one per COMPANY user.
 *  - 12 PUBLISHED JobOffers, spread over all 5 companies, deletedAt = null and
 *     expiresAt in the future (matches createJobOfferSchema + the public list
 *     filter `(expires_at IS NULL OR expires_at > NOW())`).
 *  - 10 CompanyBenefit rows (1 CORE + 1 ADDITIONAL per company) plus 12
 *    JobOfferBenefit links and 24 JobLanguage rows, so the company benefits,
 *    job-detail and company jobs endpoints return meaningful data.
 *  - 300 Applications (3 per candidate over distinct jobs) which respect the
 *    @@unique([candidateId, jobOfferId]) constraint.
 *
 * Identity map (deterministic):
 *   Candidate N      -> userN@gmail.com        -> Candidate row (firstName "Candidate", lastName "N")
 *   Test Company C   -> companyC@cxjobs.test   -> companies row (slug "k6-test-company-C")
 *   Test Job N       -> slug "k6-test-job-N"   -> company ((N-1) % 5) + 1
 *   Candidate N app  -> jobs ((N-1)*3 + a) mod 12, a in {0,1,2}
 *
 * Password: a single bcrypt (bcryptjs, cost 10) hash of the documented test
 * password is created once and reused, exactly as prisma/seed.ts does. The
 * plaintext value is never logged.
 *
 * Deletion safety: the only `deleteMany` calls below are scoped to the rows this
 * script itself owns (its own candidate ids, company ids and job ids) so that a
 * rerun does not duplicate child rows. No unrelated or pre-existing data is
 * removed, and no table-wide delete is issued.
 *
 * Run (from the repo root, with .env loaded):
 *   npx tsx prisma/seed-k6.ts
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  Prisma,
  JobRoleTarget,
  WorkMode,
  ShiftType,
  ContractType,
  EmploymentType,
  ActivityType,
  ApplicationStatus,
  BenefitCategory,
  BenefitScope,
  JobOfferStatus,
  ApplicationMethod,
  LanguageLevel,
} from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Load the environment first (dotenv reads .env) before running this seed."
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Deterministic test credential. Hashed with bcryptjs exactly like lib/auth.ts
// verifies it; the plaintext is never printed.
const TEST_PASSWORD = "12345678";
const BCRYPT_SALT_ROUNDS = 10;

const CANDIDATE_COUNT = 100;
const COMPANY_COUNT = 5;
const JOB_COUNT = 12;
const APPLICATIONS_PER_CANDIDATE = 3;

const JOB_VALIDITY_MONTHS = 6;

const candidateEmails = Array.from(
  { length: CANDIDATE_COUNT },
  (_, i) => `user${i + 1}@gmail.com`
);

const companyEmails = Array.from(
  { length: COMPANY_COUNT },
  (_, i) => `company${i + 1}@cxjobs.test`
);

const allEmails = [...candidateEmails, ...companyEmails];

// Enum value pools, all taken verbatim from prisma/schema.prisma.
const JOB_ROLE_TARGETS: JobRoleTarget[] = [
  "CALL_CENTER",
  "SALES",
  "TECH_SUPPORT",
  "CUSTOMER_SERVICE",
  "ADMIN",
  "GENERAL",
];

const WORK_MODES: WorkMode[] = ["ONSITE", "REMOTE", "HYBRID"];
const SHIFT_TYPES: ShiftType[] = ["DAY", "NIGHT", "FLEXIBLE", "ROTATION"];

// Only "Male" and "Female" are accepted by genderSchema (exact, case-sensitive).
const GENDERS = ["Male", "Female"] as const;

const CANDIDATE_LOCATIONS = [
  "Tunis, Tunisia",
  "Sousse, Tunisia",
  "Sfax, Tunisia",
  "Sousse, Tunisia",
];

const SKILL_NAMES = [
  "Communication",
  "Customer Service",
  "Active Listening",
  "Problem Solving",
  "CRM",
  "Time Management",
  "Teamwork",
  "Adaptability",
];

const LANGUAGE_PROFILES = [
  { name: "English", proficiency: "Advanced" },
  { name: "French", proficiency: "Intermediate" },
];

const CONTRACT_TYPES: ContractType[] = ["CDI", "CIVP", "KARAMA", "FREELANCE"];
const EMPLOYMENT_TYPES: EmploymentType[] = ["FULL_TIME", "PART_TIME"];
const ACTIVITY_TYPES: ActivityType[] = [
  "CUSTOMER_SERVICE",
  "TECHNICAL_IT_SUPPORT",
  "SALES_LEAD_GENERATION",
  "BACK_OFFICE_DIGITAL_SERVICES",
];
const APPLICATION_STATUSES: ApplicationStatus[] = [
  "NOUVEAU",
  "EN_COURS_EXAMEN",
  "ENTRETIEN",
  "EMBAUCHES",
  "REFUSE",
];
const BENEFIT_CATEGORIES: BenefitCategory[] = [
  "HEALTH",
  "FINANCIAL",
  "WORK_ENVIRONMENT",
];
const BENEFIT_SCOPES: BenefitScope[] = ["CORE", "ADDITIONAL"];
const JOB_LANGUAGE_LEVELS: LanguageLevel[] = ["REQUIRED", "PREFERRED"];

const COMPANY_SIZES = ["11-50", "51-200", "201-500", "501-1000", "1000+"];
const COMPANY_LOCATIONS = ["Tunis, Tunisia", "Sousse, Tunisia", "Sfax, Tunisia", "Tunis, Tunisia", "Sousse, Tunisia"];
const COMPANY_WEBSITES = [
  "https://k6-test-company-1.example",
  "https://k6-test-company-2.example",
  "https://k6-test-company-3.example",
  "https://k6-test-company-4.example",
  "https://k6-test-company-5.example",
];
const FOUNDED_YEARS = [2009, 2012, 2015, 2017, 2019];

/** Deterministic date helper: no Date.now() inside per-row data. */
function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function addMonths(from: Date, months: number): Date {
  const result = new Date(from);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/**
 * Deterministic application status distribution, so the company application
 * lists and /api/dashboard/company analytics buckets are non-empty:
 * 12 NOUVEAU, 4 EN_COURS_EXAMEN, 2 ENTRETIEN, 1 EMBAUCHES, 1 REFUSE per 20.
 */
function applicationStatusFor(sequence: number): ApplicationStatus {
  const bucket = sequence % 20;
  if (bucket < 12) return APPLICATION_STATUSES[0];
  if (bucket < 16) return APPLICATION_STATUSES[1];
  if (bucket < 18) return APPLICATION_STATUSES[2];
  if (bucket === 18) return APPLICATION_STATUSES[3];
  return APPLICATION_STATUSES[4];
}

async function main() {
  const startedAt = Date.now();

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_SALT_ROUNDS);
  const hashVerified = await bcrypt.compare(TEST_PASSWORD, passwordHash);
  if (!hashVerified) {
    throw new Error("Generated bcrypt hash failed verification.");
  }

  const now = new Date();
  const jobsExpireAt = addMonths(now, JOB_VALIDITY_MONTHS);

  // ---------------------------------------------------------------- users ---
  // createMany + skipDuplicates never duplicates on rerun; the scoped
  // updateMany re-asserts role/isActive/isOnboarded/passwordHash for pre-existing
  // rows so a rerun converges to the exact same dataset.
  const candidateUserRows: Prisma.UserCreateManyInput[] = candidateEmails.map(
    (email, i) => ({
      email,
      name: `Candidate ${i + 1}`,
      passwordHash,
      role: "CANDIDATE",
      isActive: true,
      isOnboarded: true,
      emailVerified: now,
    })
  );

  const companyUserRows: Prisma.UserCreateManyInput[] = companyEmails.map(
    (email, i) => ({
      email,
      name: `Company ${i + 1}`,
      passwordHash,
      role: "COMPANY",
      isActive: true,
      isOnboarded: true,
      emailVerified: now,
    })
  );

  await prisma.user.createMany({ data: [...candidateUserRows, ...companyUserRows], skipDuplicates: true });

  await prisma.user.updateMany({
    where: { email: { in: candidateEmails } },
    data: { role: "CANDIDATE", isActive: true, isOnboarded: true, passwordHash },
  });

  await prisma.user.updateMany({
    where: { email: { in: companyEmails } },
    data: { role: "COMPANY", isActive: true, isOnboarded: true, passwordHash },
  });

  const users = await prisma.user.findMany({
    where: { email: { in: allEmails } },
    select: { id: true, email: true, role: true, isActive: true, isOnboarded: true },
  });

  const userIdByEmail = new Map<string, string>();
  for (const user of users) {
    userIdByEmail.set(user.email, user.id);
  }

  const missingUsers = allEmails.filter((email) => !userIdByEmail.has(email));
  if (missingUsers.length > 0) {
    throw new Error(`Failed to resolve ${missingUsers.length} seeded user(s): ${missingUsers.slice(0, 5).join(", ")}`);
  }

  // ------------------------------------------------------------ companies ---
  const companyIds: string[] = [];

  for (let c = 1; c <= COMPANY_COUNT; c++) {
    const email = `company${c}@cxjobs.test`;
    const userId = userIdByEmail.get(email)!;

    const company = await prisma.companies.upsert({
      where: { userId },
      update: {
        name: `Test Company ${c}`,
        slug: `k6-test-company-${c}`,
        description: `Test Company ${c} is a deterministic K6 performance-test company profile.`,
        location: COMPANY_LOCATIONS[c - 1],
        companySize: COMPANY_SIZES[c - 1],
        website: COMPANY_WEBSITES[c - 1],
        foundedYear: FOUNDED_YEARS[c - 1],
        isRemoteFriendly: true,
        isHybridFriendly: c % 2 === 1,
        deletedAt: null,
      },
      create: {
        userId,
        name: `Test Company ${c}`,
        slug: `k6-test-company-${c}`,
        description: `Test Company ${c} is a deterministic K6 performance-test company profile.`,
        location: COMPANY_LOCATIONS[c - 1],
        companySize: COMPANY_SIZES[c - 1],
        website: COMPANY_WEBSITES[c - 1],
        foundedYear: FOUNDED_YEARS[c - 1],
        isRemoteFriendly: true,
        isHybridFriendly: c % 2 === 1,
        deletedAt: null,
      },
    });

    companyIds.push(company.id);
  }

  // ------------------------------------------------------------------ jobs ---
  // Job N belongs to company ((N-1) % 5) + 1, so with 12 jobs every company owns
  // at least two and companies 1 and 2 own three.
  const jobIds: string[] = [];

  for (let j = 1; j <= JOB_COUNT; j++) {
    const companyIndex = ((j - 1) % COMPANY_COUNT) + 1;
    const companyId = companyIds[companyIndex - 1];
    const slug = `k6-test-job-${j}`;
    const title = `Test Job ${j}`;
    const isRemote = j % 3 !== 0;

    const jobOfferData = {
      companyId,
      title,
      slug,
      description: `Test Job ${j} is a published K6 performance-test job offer owned by Test Company ${companyIndex}.`,
      requirements: ["Reliability", "Teamwork", "Communication"],
      customLocation: CANDIDATE_LOCATIONS[(j - 1) % CANDIDATE_LOCATIONS.length],
      contractType: CONTRACT_TYPES[(j - 1) % CONTRACT_TYPES.length],
      employmentType: EMPLOYMENT_TYPES[(j - 1) % EMPLOYMENT_TYPES.length],
      activityType: ACTIVITY_TYPES[(j - 1) % ACTIVITY_TYPES.length],
      isRemote,
      isHybrid: !isRemote,
      salaryMin: 30000 + (j - 1) * 1000,
      salaryMax: 60000 + (j - 1) * 1000,
      salaryCurrency: "USD",
      status: "PUBLISHED" as JobOfferStatus,
      publishedAt: now,
      closedAt: null,
      expiresAt: jobsExpireAt,
      deletedAt: null,
      applicationType: "INTERNAL" as ApplicationMethod,
      softSkills: ["Teamwork", "Communication"],
      technicalTools: ["Excel", "CRM"],
      metaTitle: `${title} | CXJobs K6 Test`,
      metaDescription: `Deterministic K6 performance-test job offer ${j}.`,
    };

    const job = await prisma.jobOffer.upsert({
      where: { slug },
      update: jobOfferData,
      create: jobOfferData,
    });

    jobIds.push(job.id);
  }

  // -------------------------------------------------------------- benefits ---
  // Scoped to this seed's own companies only, so reruns cannot duplicate
  // benefit rows (CompanyBenefit has no unique key).
  await prisma.companyBenefit.deleteMany({ where: { companyId: { in: companyIds } } });

  const benefitRows: Prisma.CompanyBenefitCreateManyInput[] = [];
  for (let c = 1; c <= COMPANY_COUNT; c++) {
    for (let b = 0; b < BENEFIT_SCOPES.length; b++) {
      benefitRows.push({
        companyId: companyIds[c - 1],
        name: `Test Company ${c} ${BENEFIT_SCOPES[b]} Benefit ${b + 1}`,
        description: `Deterministic K6 test benefit ${b + 1} (${BENEFIT_SCOPES[b]}) for Test Company ${c}.`,
        category: BENEFIT_CATEGORIES[(c - 1 + b) % BENEFIT_CATEGORIES.length],
        scope: BENEFIT_SCOPES[b],
      });
    }
  }
  await prisma.companyBenefit.createMany({ data: benefitRows });

  const benefits = await prisma.companyBenefit.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true, companyId: true, scope: true },
    orderBy: { createdAt: "asc" },
  });

  // Each job links to its own company's first CORE benefit, and declares two
  // distinct languages (JobLanguage is @@unique([jobOfferId, language])).
  const jobBenefitRows: Prisma.JobOfferBenefitCreateManyInput[] = [];
  const jobLanguageRows: Prisma.JobLanguageCreateManyInput[] = [];

  for (let j = 1; j <= JOB_COUNT; j++) {
    const companyId = companyIds[((j - 1) % COMPANY_COUNT)];
    const coreBenefit = benefits.find((benefit) => benefit.companyId === companyId && benefit.scope === "CORE");

    if (coreBenefit) {
      jobBenefitRows.push({ jobOfferId: jobIds[j - 1], benefitId: coreBenefit.id });
    }

    for (let l = 0; l < 2; l++) {
      jobLanguageRows.push({
        jobOfferId: jobIds[j - 1],
        language: LANGUAGE_PROFILES[l].name,
        level: JOB_LANGUAGE_LEVELS[l],
      });
    }
  }

  await prisma.jobOfferBenefit.createMany({ data: jobBenefitRows, skipDuplicates: true });
  await prisma.jobLanguage.createMany({ data: jobLanguageRows, skipDuplicates: true });

  // ------------------------------------------------------------ candidates ---
  const candidateIds: string[] = [];

  for (let n = 1; n <= CANDIDATE_COUNT; n++) {
    const email = `user${n}@gmail.com`;
    const userId = userIdByEmail.get(email)!; 

    const candidateData = {
      firstName: "Candidate",
      lastName: `${n}`,
      phone: `+216 20 000 ${String(n).padStart(3, "0")}`,
      location: CANDIDATE_LOCATIONS[(n - 1) % CANDIDATE_LOCATIONS.length],
      headline: `Candidate ${n}`,
      summary: `Candidate ${n} is a deterministic K6 performance-test candidate profile.`,
      targetJobRole: JOB_ROLE_TARGETS[(n - 1) % JOB_ROLE_TARGETS.length],
      workMode: WORK_MODES[(n - 1) % WORK_MODES.length],
      shiftType: SHIFT_TYPES[(n - 1) % SHIFT_TYPES.length],
      // genderSchema accepts exactly "Male" or "Female" (case-sensitive).
      gender: GENDERS[(n - 1) % GENDERS.length],
      // Ages 26..40 at seed time; hasValidDateOfBirth only requires a real date.
      dateOfBirth: utcDate(1985 + ((n - 1) % 15), (n - 1) % 12, 1 + ((n - 1) % 27)),
      preferredJobTypes: ["FULL_TIME", "PART_TIME"],
    };

    const candidate = await prisma.candidate.upsert({
      where: { userId },
      update: candidateData,
      create: { userId, ...candidateData },
    });

    candidateIds.push(candidate.id);
  }

  // ------------------------------------------------- candidate sub-relations ---
  // Child tables have no unique key, so the scoped delete below (this seed's own
  // candidate ids only) is what makes reruns idempotent.
  await prisma.$transaction([
    prisma.candidateSkill.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.experience.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.education.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.language.deleteMany({ where: { candidateId: { in: candidateIds } } }),
  ]);

  const skillRows: Prisma.CandidateSkillCreateManyInput[] = [];
  const experienceRows: Prisma.ExperienceCreateManyInput[] = [];
  const educationRows: Prisma.EducationCreateManyInput[] = [];
  const languageRows: Prisma.LanguageCreateManyInput[] = [];

  for (let n = 1; n <= CANDIDATE_COUNT; n++) {
    const candidateId = candidateIds[n - 1];

    // 3 skills per candidate.
    for (let s = 0; s < 3; s++) {
      skillRows.push({
        candidateId,
        name: SKILL_NAMES[(n - 1 + s) % SKILL_NAMES.length],
        level: s === 0 ? "Advanced" : "Intermediate",
        yearsOfExperience: 1 + ((n + s) % 5),
      });
    }

    // 1 experience, plus a second one for every 5th candidate.
    experienceRows.push({
      candidateId,
      title: `Test Position ${n}`,
      company: "Test Company Experience",
      location: CANDIDATE_LOCATIONS[(n - 1) % CANDIDATE_LOCATIONS.length],
      startDate: utcDate(2021, (n - 1) % 12, 1),
      isCurrent: true,
      description: `Current role of test candidate ${n}.`,
    });

    if (n % 5 === 0) {
      experienceRows.push({
        candidateId,
        title: `Previous Test Position ${n}`,
        company: "Test Company Previous",
        location: CANDIDATE_LOCATIONS[(n - 1) % CANDIDATE_LOCATIONS.length],
        startDate: utcDate(2018, (n - 1) % 12, 1),
        endDate: utcDate(2021, (n - 1) % 12, 1),
        isCurrent: false,
        description: `Previous role of test candidate ${n}.`,
      });
    }

    // 1 education, plus a second one for every 4th candidate.
    educationRows.push({
      candidateId,
      school: "Test University",
      degree: "Bachelor of Arts",
      fieldOfStudy: "Business Administration",
      startDate: utcDate(2015, (n - 1) % 12, 1),
      endDate: utcDate(2019, (n - 1) % 12, 1),
      isCurrent: false,
    });

    if (n % 4 === 0) {
      educationRows.push({
        candidateId,
        school: "Test Institute",
        degree: "Master of Science",
        fieldOfStudy: "Information Technology",
        startDate: utcDate(2019, (n - 1) % 12, 1),
        endDate: utcDate(2021, (n - 1) % 12, 1),
        isCurrent: false,
      });
    }

    // 1 language, plus a second one for every 3rd candidate.
    languageRows.push({
      candidateId,
      name: LANGUAGE_PROFILES[0].name,
      proficiency: LANGUAGE_PROFILES[0].proficiency,
    });

    if (n % 3 === 0) {
      languageRows.push({
        candidateId,
        name: LANGUAGE_PROFILES[1].name,
        proficiency: LANGUAGE_PROFILES[1].proficiency,
      });
    }
  }

  await prisma.candidateSkill.createMany({ data: skillRows });
  await prisma.experience.createMany({ data: experienceRows });
  await prisma.education.createMany({ data: educationRows });
  await prisma.language.createMany({ data: languageRows });

  // ---------------------------------------------------------- applications ---
  // @@unique([candidateId, jobOfferId]) plus skipDuplicates means this can be
  // rerun without ever creating a duplicate application. The three job indices
  // per candidate are consecutive mod JOB_COUNT, so they are always distinct.
  const applicationRows: Prisma.ApplicationCreateManyInput[] = [];
  let applicationSequence = 0;

  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    for (let a = 0; a < APPLICATIONS_PER_CANDIDATE; a++) {
      const jobId = jobIds[(i * APPLICATIONS_PER_CANDIDATE + a) % JOB_COUNT];
      const status = applicationStatusFor(applicationSequence);

      applicationRows.push({
        candidateId: candidateIds[i],
        jobOfferId: jobId,
        coverLetter: `Deterministic K6 test application ${applicationSequence + 1}.`,
        status,
        notes: status === "NOUVEAU" ? null : `K6 test review note ${applicationSequence + 1}.`,
        isSaved: (i + a) % 5 === 0,
      });

      applicationSequence++;
    }
  }

  await prisma.application.createMany({ data: applicationRows, skipDuplicates: true });

  // ---------------------------------------------------------- verification ---
  const verifiedUsers = await prisma.user.findMany({
    where: { email: { in: allEmails } },
    select: { email: true, role: true, isActive: true, isOnboarded: true },
  });

  const verifiedCandidates = await prisma.candidate.findMany({
    where: { id: { in: candidateIds } },
    select: {
      id: true,
      gender: true,
      firstName: true,
      lastName: true,
      phone: true,
      location: true,
      targetJobRole: true,
      dateOfBirth: true,
      skills: { select: { id: true } },
      experiences: { select: { id: true } },
      education: { select: { id: true } },
      languages: { select: { id: true } },
    },
  });

  const verifiedCompanies = await prisma.companies.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, userId: true, slug: true, deletedAt: true, _count: { select: { jobs: true, benefits: true } } },
  });

  const verifiedJobs = await prisma.jobOffer.findMany({
    where: { id: { in: jobIds } },
    select: { id: true, slug: true, status: true, deletedAt: true, expiresAt: true, companyId: true },
  });

  // Duplicate detection is done in JS on the (candidateId, jobOfferId) pairs so
  // it does not depend on groupBy/having typing across Prisma versions.
  const applicationPairs = await prisma.application.findMany({
    where: { candidateId: { in: candidateIds } },
    select: { candidateId: true, jobOfferId: true },
  });

  const pairCounts = new Map<string, number>();
  for (const pair of applicationPairs) {
    const key = `${pair.candidateId}|${pair.jobOfferId}`;
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  const duplicateApplicationPairs = [...pairCounts.values()].filter((count) => count > 1);

  const verifiedApplications = await prisma.application.findMany({
    where: { candidateId: { in: candidateIds } },
    select: { id: true, status: true, jobOffer: { select: { status: true } } },
  });

  const problems: string[] = [];

  const candidateUsers = verifiedUsers.filter((user) => user.role === "CANDIDATE");
  const companyUsers = verifiedUsers.filter((user) => user.role === "COMPANY");

  if (candidateUsers.length !== CANDIDATE_COUNT) {
    problems.push(`Expected ${CANDIDATE_COUNT} CANDIDATE users, found ${candidateUsers.length}`);
  }
  if (companyUsers.length !== COMPANY_COUNT) {
    problems.push(`Expected ${COMPANY_COUNT} COMPANY users, found ${companyUsers.length}`);
  }

  const inactiveOrUnonboarded = verifiedUsers.filter((user) => !user.isActive || !user.isOnboarded);
  if (inactiveOrUnonboarded.length > 0) {
    problems.push(`${inactiveOrUnonboarded.length} user(s) are not active/onboarded`);
  }

  if (verifiedCandidates.length !== CANDIDATE_COUNT) {
    problems.push(`Expected ${CANDIDATE_COUNT} Candidate rows, found ${verifiedCandidates.length}`);
  }

  const invalidGender = verifiedCandidates.filter(
    (candidate) => candidate.gender !== "Male" && candidate.gender !== "Female"
  );
  if (invalidGender.length > 0) {
    problems.push(`${invalidGender.length} candidate(s) have a gender outside {Male, Female}`);
  }

  const incompleteCandidate = verifiedCandidates.filter(
    (candidate) =>
      !candidate.firstName ||
      !candidate.lastName ||
      !candidate.phone ||
      !candidate.location ||
      !candidate.targetJobRole ||
      !candidate.dateOfBirth ||
      candidate.skills.length < 3 ||
      candidate.experiences.length < 1 ||
      candidate.education.length < 1 ||
      candidate.languages.length < 1
  );
  if (incompleteCandidate.length > 0) {
    problems.push(`${incompleteCandidate.length} candidate(s) miss an onboarding-required field or relation`);
  }

  if (verifiedCompanies.length !== COMPANY_COUNT) {
    problems.push(`Expected ${COMPANY_COUNT} Company rows, found ${verifiedCompanies.length}`);
  }

  const companyJobCounts = new Map<string, number>();
  for (const job of verifiedJobs) {
    companyJobCounts.set(job.companyId, (companyJobCounts.get(job.companyId) ?? 0) + 1);
  }
  for (const company of verifiedCompanies) {
    if ((companyJobCounts.get(company.id) ?? 0) < 2) {
      problems.push(`${company.slug} owns fewer than 2 job offers`);
    }
  }

  const invalidJobs = verifiedJobs.filter(
    (job) => job.status !== "PUBLISHED" || job.deletedAt !== null || !job.expiresAt || job.expiresAt <= now
  );
  if (invalidJobs.length > 0) {
    problems.push(`${invalidJobs.length} job offer(s) are not published/active with a future expiresAt`);
  }

  if (duplicateApplicationPairs.length > 0) {
    problems.push(`${duplicateApplicationPairs.length} duplicate (candidateId, jobOfferId) application pair(s)`);
  }

  const applicationsOnUnpublishedJobs = verifiedApplications.filter(
    (application) => application.jobOffer.status !== "PUBLISHED"
  );
  if (applicationsOnUnpublishedJobs.length > 0) {
    problems.push(`${applicationsOnUnpublishedJobs.length} application(s) target a non-PUBLISHED job offer`);
  }

  const genderBreakdown = verifiedCandidates.reduce<Record<string, number>>((acc, candidate) => {
    const key = candidate.gender ?? "null";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const statusBreakdown = verifiedApplications.reduce<Record<string, number>>((acc, application) => {
    acc[application.status] = (acc[application.status] ?? 0) + 1;
    return acc;
  }, {});

  const skillCount = verifiedCandidates.reduce((sum, candidate) => sum + candidate.skills.length, 0);
  const experienceCount = verifiedCandidates.reduce((sum, candidate) => sum + candidate.experiences.length, 0);
  const educationCount = verifiedCandidates.reduce((sum, candidate) => sum + candidate.education.length, 0);
  const languageCount = verifiedCandidates.reduce((sum, candidate) => sum + candidate.languages.length, 0);

  console.log("\n============================================================");
  console.log("CXJobs K6 performance-test seed (prisma/seed-k6.ts)");
  console.log("============================================================");
  console.log(`Users (CANDIDATE)          : ${candidateUsers.length}`);
  console.log(`Users (COMPANY)            : ${companyUsers.length}`);
  console.log(`Users (total)              : ${verifiedUsers.length}`);
  console.log(`Candidate profiles         : ${verifiedCandidates.length}`);
  console.log(`Company profiles           : ${verifiedCompanies.length}`);
  console.log(`Published job offers       : ${verifiedJobs.filter((job) => job.status === "PUBLISHED").length}`);
  console.log(`Job offers per company     : ${[...companyJobCounts.entries()]
    .map(([companyId, count]) => `${verifiedCompanies.find((company) => company.id === companyId)?.slug}=${count}`)
    .join(", ")}`);
  console.log(`Company benefits           : ${benefits.length}`);
  console.log(`Job benefit links          : ${jobBenefitRows.length}`);
  console.log(`Job languages              : ${jobLanguageRows.length}`);
  console.log(`Applications               : ${verifiedApplications.length}`);
  console.log(`Application statuses       : ${JSON.stringify(statusBreakdown)}`);
  console.log(`Candidate skills           : ${skillCount}`);
  console.log(`Candidate experiences      : ${experienceCount}`);
  console.log(`Candidate educations       : ${educationCount}`);
  console.log(`Candidate languages        : ${languageCount}`);
  console.log(`Gender values in use       : ${JSON.stringify(genderBreakdown)}`);
  console.log(`All users active           : ${inactiveOrUnonboarded.length === 0}`);
  console.log(`All users onboarded        : ${inactiveOrUnonboarded.length === 0}`);
  console.log(`Passwords bcrypt-hashed    : true (bcryptjs, cost ${BCRYPT_SALT_ROUNDS})`);
  console.log(`Plaintext passwords logged : false`);
  console.log(`Job offers expire at       : ${jobsExpireAt.toISOString()}`);
  console.log(`Elapsed                    : ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  console.log("------------------------------------------------------------");
  console.log("Deterministic identities:");
  console.log("  Candidate N  -> userN@gmail.com (N = 1..100)");
  console.log("  Test Company C -> companyC@cxjobs.test, slug k6-test-company-C (C = 1..5)");
  console.log("  Test Job N     -> slug k6-test-job-N, company ((N-1) % 5) + 1 (N = 1..12)");
  console.log("============================================================");

  if (problems.length > 0) {
    console.error("\nVerification FAILED:");
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    throw new Error(`${problems.length} verification problem(s) detected.`);
  }

  console.log("\nVerification passed: dataset is complete, valid and consistent.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });