import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Deterministic test credentials. Passwords are bcrypt-hashed; the plaintext
// value is never logged and never committed to cookies/session tokens.
const TEST_PASSWORD = "12345678";
const BCRYPT_SALT_ROUNDS = 10;

// Candidate population.
// 100 candidates (>= the K6 multi-user default of 50 VUs) so every VU can map
// to a distinct, valid candidate session cookie instead of forcing reuse, while
// keeping the dataset controlled and reproducible.
const CANDIDATE_COUNT = 50;

// Company owners + published job offers. Enough companies/jobs to populate
// /api/job-offers and /jobs/[slug] without an enormous dataset.
const COMPANY_COUNT = 5;
const JOBS_PER_COMPANY = 2; // 10 published jobs total

// Each candidate gets a few applications so the candidate dashboard surfaces
// realistic application data (stats + recent applications list).
const APPLICATIONS_PER_CANDIDATE = 3; // 300 applications total

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, BCRYPT_SALT_ROUNDS);
  const isHashValid = await bcrypt.compare(TEST_PASSWORD, passwordHash);
  if (!isHashValid) {
    throw new Error("Generated bcrypt hash failed verification.");
  }

  const stats = {
    usersUpserted: 0,
    candidatesUpserted: 0,
    companiesUpserted: 0,
    jobsUpserted: 0,
    skillsUpserted: 0,
    experiencesUpserted: 0,
    educationsUpserted: 0,
    languagesUpserted: 0,
    applicationsUpserted: 0,
  };

  const now = new Date();
  const sixMonthsAhead = new Date(now);
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

  const jobOffers: { id: string; slug: string }[] = [];

  // --- Company owners, companies, and published job offers ---
  for (let c = 1; c <= COMPANY_COUNT; c++) {
    const companyEmail = `company${c}@cxjobs.test`;
    const companyUser = await prisma.user.upsert({
      where: { email: companyEmail },
      update: {
        name: `Company ${c}`,
        passwordHash,
        role: "COMPANY",
        isActive: true,
        isOnboarded: true,
      },
      create: {
        email: companyEmail,
        name: `Company ${c}`,
        passwordHash,
        role: "COMPANY",
        isActive: true,
        isOnboarded: true,
      },
    });
    stats.usersUpserted += 1;

    const company = await prisma.companies.upsert({
      where: { userId: companyUser.id },
      update: {
        name: `Test Company ${c}`,
        slug: `test-company-${c}`,
        description: `Test company ${c} backing the CXJobs K6 benchmark dataset.`,
        isRemoteFriendly: true,
      },
      create: {
        userId: companyUser.id,
        name: `Test Company ${c}`,
        slug: `test-company-${c}`,
        description: `Test company ${c} backing the CXJobs K6 benchmark dataset.`,
        isRemoteFriendly: true,
      },
    });
    stats.companiesUpserted += 1;

    for (let j = 1; j <= JOBS_PER_COMPANY; j++) {
      const slug = `test-job-${c}-${j}`;
      const title = `Test Position ${c}-${j}`;
      const job = await prisma.jobOffer.upsert({
        where: { slug },
        update: {
          companyId: company.id,
          title,
          slug,
          description: `Published test position ${c}-${j} for the CXJobs K6 benchmark.`,
          requirements: ["Reliability", "Teamwork"],
          status: "PUBLISHED",
          publishedAt: now,
          expiresAt: sixMonthsAhead,
          deletedAt: null,
          contractType: "CDI",
          employmentType: "FULL_TIME",
          isRemote: true,
          salaryMin: 30000,
          salaryMax: 60000,
          salaryCurrency: "USD",
          activityType: "CUSTOMER_SERVICE",
        },
        create: {
          companyId: company.id,
          title,
          slug,
          description: `Published test position ${c}-${j} for the CXJobs K6 benchmark.`,
          requirements: ["Reliability", "Teamwork"],
          status: "PUBLISHED",
          publishedAt: now,
          expiresAt: sixMonthsAhead,
          deletedAt: null,
          contractType: "CDI",
          employmentType: "FULL_TIME",
          isRemote: true,
          salaryMin: 30000,
          salaryMax: 60000,
          salaryCurrency: "USD",
          activityType: "CUSTOMER_SERVICE",
        },
      });
      stats.jobsUpserted += 1;
      jobOffers.push({ id: job.id, slug: job.slug });
    }
  }

  // --- 100 candidate users + candidate profiles ---
  const candidateIds: string[] = [];
  for (let n = 100; n <= 200; n++) {
    const email = `user${n}@gmail.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: `Test${n}`,
        passwordHash,
        role: "CANDIDATE",
        isActive: true,
        isOnboarded: true,
      },
      create: {
        email,
        name: `Test${n}`,
        passwordHash,
        role: "CANDIDATE",
        isActive: true,
        isOnboarded: true,
      },
    });
    stats.usersUpserted += 1;

    const candidate = await prisma.candidate.upsert({
      where: { userId: user.id },
      update: {
        firstName: "Test",
        lastName: `User${n}`,
        headline: `Candidate ${n}`,
        summary: `Seeded test candidate ${n} for the CXJobs K6 benchmark.`,
        location: "Remote",
        shiftType: "DAY",
        targetJobRole: "GENERAL",
        workMode: "REMOTE",
        preferredJobTypes: ["FULL_TIME", "PART_TIME"],
      },
      create: {
        userId: user.id,
        firstName: "Test",
        lastName: `User${n}`,
        headline: `Candidate ${n}`,
        summary: `Seeded test candidate ${n} for the CXJobs K6 benchmark.`,
        location: "Remote",
        shiftType: "DAY",
        targetJobRole: "GENERAL",
        workMode: "REMOTE",
        preferredJobTypes: ["FULL_TIME", "PART_TIME"],
      },
    });
    stats.candidatesUpserted += 1;
    candidateIds.push(candidate.id);
  }

  // --- Profile sub-relations (skills/experience/education/languages) ---
  // Reset and recreate for the test candidates only so the seed is repeatable.
  const skillsData = candidateIds.map((candidateId, i) => ({
    candidateId,
    name: i % 2 === 0 ? "Communication" : "Customer Service",
    yearsOfExperience: (i % 5) + 1,
  }));

  const experiencesData = candidateIds.map((candidateId, i) => ({
    candidateId,
    company: "Acme Corp",
    title: "Customer Service Representative",
    startDate: new Date(2022, 0, 1),
    isCurrent: false,
  }));

  const educationsData = candidateIds.map((candidateId) => ({
    candidateId,
    school: "Test University",
    degree: "Bachelor of Arts",
    startDate: new Date(2018, 0, 1),
    isCurrent: false,
  }));

  const languagesData = candidateIds.map((candidateId) => ({
    candidateId,
    name: "English",
    proficiency: "Advanced",
  }));

  // --- Applications (deterministic, cycling across the published jobs) ---
  const applicationsData: Prisma.ApplicationCreateManyInput[] = [];
  for (let i = 0; i < candidateIds.length; i++) {
    for (let a = 0; a < APPLICATIONS_PER_CANDIDATE; a++) {
      const job = jobOffers[(i * APPLICATIONS_PER_CANDIDATE + a) % jobOffers.length];
      applicationsData.push({
        candidateId: candidateIds[i],
        jobOfferId: job.id,
        status: "NOUVEAU",
        coverLetter: "",
      });
    }
  }

  await prisma.$transaction([
    prisma.candidateSkill.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.experience.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.education.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.language.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.application.deleteMany({ where: { candidateId: { in: candidateIds } } }),
    prisma.candidateSkill.createMany({ data: skillsData, skipDuplicates: true }),
    prisma.experience.createMany({ data: experiencesData, skipDuplicates: true }),
    prisma.education.createMany({ data: educationsData, skipDuplicates: true }),
    prisma.language.createMany({ data: languagesData, skipDuplicates: true }),
    prisma.application.createMany({ data: applicationsData, skipDuplicates: true }),
  ]);

  stats.skillsUpserted = skillsData.length;
  stats.experiencesUpserted = experiencesData.length;
  stats.educationsUpserted = educationsData.length;
  stats.languagesUpserted = languagesData.length;
  stats.applicationsUpserted = applicationsData.length;

  console.log("\nCXJobs K6 candidate dataset seed completed.");
  console.log(`Users upserted: ${stats.usersUpserted} (CANDIDATE: ${CANDIDATE_COUNT}, COMPANY: ${COMPANY_COUNT})`);
  console.log(`Candidate profiles: ${stats.candidatesUpserted}`);
  console.log(`Companies: ${stats.companiesUpserted}`);
  console.log(`Published job offers: ${stats.jobsUpserted}`);
  console.log(`Candidate skills: ${stats.skillsUpserted}`);
  console.log(`Candidate experiences: ${stats.experiencesUpserted}`);
  console.log(`Candidate educations: ${stats.educationsUpserted}`);
  console.log(`Candidate languages: ${stats.languagesUpserted}`);
  console.log(`Applications: ${stats.applicationsUpserted}`);
  console.log("Onboarding state: isOnboarded=true for all seeded candidate/company users");
  console.log("Active state: isActive=true for all seeded users");
  console.log("Passwords bcrypt-hashed: true");
  console.log("Plaintext passwords logged: false");
  console.log(
    `Endpoints covered: /dashboard/candidate, /api/dashboard/candidate, ` +
      `/dashboard/candidate/profile, /dashboard/candidate/applications, ` +
      `/api/application, /api/job-offers, /jobs/[slug], /api/job-offers/by-slug/[slug]`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
