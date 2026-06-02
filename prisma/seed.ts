import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_DATABASE_URL || "";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

// ─── Constants ────────────────────────────────────────────────────────────────
const CANDIDATE_COUNT = 10_000;
const COMPANY_COUNT = 100;
const JOB_OFFER_COUNT = 400;
const APPLICATION_COUNT = 50_000;
const BATCH_SIZE = 500; // rows per createMany call

// ─── Data pools ───────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  "Ahmed","Mohamed","Youssef","Ali","Omar","Khalil","Bilel","Nizar","Amine","Rami",
  "Fatma","Sana","Maryem","Ines","Salma","Rim","Nour","Hana","Asma","Amira",
  "Karim","Samir","Tarek","Zied","Hedi","Sofien","Walid","Maher","Sami","Anis",
  "Leila","Dorra","Sirine","Yasmine","Meriem","Olfa","Hanen","Wafa","Radhia","Najet",
];

const LAST_NAMES = [
  "Ben Ali","Messaoud","Khalfi","Bouazzi","Mezghich","Trabelsi","Riahi","Hamdi",
  "Jebali","Chaabane","Ayari","Bouzid","Mansouri","Amdouni","Dridi","Haddad",
  "Souissi","Tlili","Ferchichi","Maatoug","Gharbi","Nasr","Zouaoui","Aloui",
  "Ben Salah","Khelifi","Oueslati","Brahem","Saidi","Baccar",
];

const TUNISIAN_CITIES = [
  "Tunis","Sfax","Sousse","Kairouan","Bizerte","Gabès","Ariana","Gafsa",
  "La Marsa","Ben Arous","Nabeul","Monastir","Hammamet","Djerba","Mahdia",
  "Kef","Sidi Bouzid","Tataouine","Médenine","Tozeur",
];

const INDUSTRIES = [
  "Call Center","Customer Service","Technology","Telecommunications",
  "Banking","Insurance","Healthcare","Retail","Logistics","Education",
];

const COMPANY_SIZES = ["1-10","11-50","51-200","201-500","501-1000","1001-5000"];
const SUBSCRIPTION_PLANS = ["FREE","ESSENTIAL","GROW","PREMIUM"];
const JOB_ROLES = ["CALL_CENTER","SALES","TECH_SUPPORT","CUSTOMER_SERVICE","ADMIN","GENERAL"];
const WORK_MODES = ["ONSITE","REMOTE","HYBRID"];
const SHIFT_TYPES = ["DAY","NIGHT","FLEXIBLE","ROTATION"];
const CONTRACT_TYPES = ["CDI","CDD","FREELANCE","INTERNSHIP","PART_TIME","APPRENTICESHIP"];
const EXP_LEVELS = ["JUNIOR","MID","SENIOR","LEAD","EXECUTIVE"];
const APP_STATUSES = ["NOUVEAU","EN_COURS_EXAMEN","ENTRETIEN","EMBAUCHES","REFUSE"];
const LANGUAGES = ["French","Arabic","English","German","Spanish","Italian"];
const LANG_LEVELS = ["REQUIRED","PREFERRED","NICE_TO_HAVE"];
const BENEFIT_CATEGORIES = ["HEALTH","FINANCIAL","WORK_ENVIRONMENT","CAREER_GROWTH","WORK_LIFE_BALANCE","OTHER"];
const SKILLS = [
  "Customer Service","Call Handling","CRM","French","English","Arabic",
  "Sales","Communication","Problem Solving","Teamwork","Microsoft Office",
  "Data Entry","Email Support","Live Chat","Technical Support","Leadership",
  "Time Management","Adaptability","Attention to Detail","Multitasking",
];

const JOB_TITLES = [
  "Call Center Agent","Customer Service Representative","Technical Support Specialist",
  "Sales Representative","Team Leader","Quality Analyst","Workforce Planner",
  "Chat Support Agent","Inbound Agent","Outbound Agent","Account Manager",
  "Customer Success Manager","Operations Supervisor","Training Specialist",
  "Back Office Agent","Fraud Analyst","Collections Agent","Billing Specialist",
  "Helpdesk Technician","CRM Specialist","Administrative Assistant","Data Analyst",
  "Customer Experience Manager","Escalation Specialist","Night Shift Agent",
];

const COVER_LETTERS = [
  "I am excited to apply for this position and believe my experience aligns well with your requirements.",
  "With my background in customer service, I am confident I can contribute positively to your team.",
  "I have been passionate about this field for years and I look forward to bringing my skills to your company.",
  "My communication skills and dedication make me an ideal candidate for this role.",
  "I thrive in fast-paced environments and am eager to take on new challenges with your team.",
  "My previous experience has prepared me well for this opportunity and I am ready to hit the ground running.",
  "I am a motivated professional seeking to leverage my expertise in a dynamic organization like yours.",
  "Your company's reputation for excellence aligns with my own professional values and goals.",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function batchInsert<T>(
  label: string,
  items: T[],
  inserter: (batch: T[]) => Promise<unknown>,
) {
  let done = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await inserter(items.slice(i, i + BATCH_SIZE));
    done += Math.min(BATCH_SIZE, items.length - i);
    process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
  }
  console.log(`\r✓ ${label}: ${items.length}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 Starting large-scale database seed...\n");

  // ── Clean ──────────────────────────────────────────────────────────────────
  console.log("Cleaning existing data...");
  await prisma.application.deleteMany();
  await prisma.jobOfferBenefit.deleteMany();
  await prisma.jobLanguage.deleteMany();
  await prisma.jobOffer.deleteMany();
  await prisma.companyBenefit.deleteMany();
  await prisma.companyCount.deleteMany();
  await prisma.companies.deleteMany();
  await prisma.candidateSkill.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.education.deleteMany();
  await prisma.language.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();
  console.log("✓ Cleaned existing data\n");

  // ── Password ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("12345678", 12);

  // ── Admin ──────────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      email: "admin@cxjobs.com",
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
      isOnboarded: true,
      emailVerified: new Date(),
    },
  });
  console.log("✓ Created admin user\n");

  // ─────────────────────────────────────────────────────────────────────────
  // COMPANIES  (100)
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`Creating ${COMPANY_COUNT} companies...`);

  const companyUserIds: string[] = [];
  for (let b = 0; b < COMPANY_COUNT; b += BATCH_SIZE) {
    const end = Math.min(b + BATCH_SIZE, COMPANY_COUNT);
    const rows = Array.from({ length: end - b }, (_, i) => {
      const idx = b + i;
      return {
        email: `company${idx}@cxjobs-seed.com`,
        name: `Company HR ${idx}`,
        passwordHash,
        role: "COMPANY" as const,
        isOnboarded: true,
        emailVerified: new Date(),
      };
    });
    // createMany doesn't return IDs so we use a loop here for company users
    const created = await Promise.all(rows.map((r) => prisma.user.create({ data: r })));
    companyUserIds.push(...created.map((u) => u.id));
    process.stdout.write(`\r  Company users: ${companyUserIds.length}/${COMPANY_COUNT}`);
  }
  console.log();

  const companiesData = companyUserIds.map((userId, idx) => {
    const industry = rand(INDUSTRIES);
    const city = rand(TUNISIAN_CITIES);
    return {
      userId,
      name: `${industry} Corp ${idx}`,
      slug: `${slugify(industry)}-corp-${idx}`,
      description: `A leading ${industry} company based in ${city}, Tunisia.`,
      industry,
      companySize: rand(COMPANY_SIZES),
      location: `${city}, Tunisia`,
      website: `https://company${idx}.example.com`,
      linkedinUrl: `https://linkedin.com/company/company${idx}`,
      culture: JSON.stringify([
        { title: "Excellence", description: "We strive for the best" },
        { title: "Teamwork", description: "Stronger together" },
      ]),
      isRemoteFriendly: Math.random() > 0.5,
      isHybridFriendly: Math.random() > 0.5,
      subscriptionPlan: rand(SUBSCRIPTION_PLANS),
      isVerified: Math.random() > 0.7,
    };
  });

  const companyIds: string[] = [];
  for (const row of companiesData) {
    const c = await prisma.companies.create({ data: row });
    companyIds.push(c.id);
    process.stdout.write(`\r  Companies: ${companyIds.length}/${COMPANY_COUNT}`);
  }
  console.log(`\r✓ Created ${COMPANY_COUNT} companies`);

  // Company counts
  await batchInsert(
    "CompanyCounts",
    companyIds.map((companyId) => ({
      companyId,
      jobs: 0,
      employees: randInt(10, 2000),
      followers: randInt(50, 10000),
    })),
    (batch) => prisma.companyCount.createMany({ data: batch }),
  );

  // Company benefits (2–4 per company)
  const benefitRows = companyIds.flatMap((companyId) =>
    Array.from({ length: randInt(2, 4) }, (_, i) => ({
      companyId,
      name: ["Health Insurance","Transport","Meal Vouchers","Remote Work","Learning Budget","Gym","Bonuses","Childcare"][i % 8],
      description: "Provided to all eligible employees.",
      icon: "gift",
      category: rand(BENEFIT_CATEGORIES) as any,
      scope: (Math.random() > 0.5 ? "CORE" : "ADDITIONAL") as any,
    }))
  );
  await batchInsert("CompanyBenefits", benefitRows, (b) => prisma.companyBenefit.createMany({ data: b }));

  // ─────────────────────────────────────────────────────────────────────────
  // JOB OFFERS  (400)
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\nCreating ${JOB_OFFER_COUNT} job offers...`);

  // Slugs must be unique globally
  const slugCounts: Record<string, number> = {};
  const makeSlug = (title: string, idx: number) => {
    const base = slugify(title);
    slugCounts[base] = (slugCounts[base] ?? -1) + 1;
    return `${base}-${idx}`;
  };

  const jobOffersData = Array.from({ length: JOB_OFFER_COUNT }, (_, idx) => {
    const title = rand(JOB_TITLES);
    const salaryMin = randInt(800, 3000);
    return {
      companyId: rand(companyIds),
      title,
      slug: makeSlug(title, idx),
      description: `We are looking for a ${title} to join our growing team in Tunisia.`,
      requirements: ["French fluency", "Customer service experience", rand(SKILLS)],
      contractType: rand(CONTRACT_TYPES) as any,
      isRemote: Math.random() > 0.6,
      isHybrid: Math.random() > 0.6,
      experienceLevel: rand(EXP_LEVELS) as any,
      salaryMin,
      salaryMax: salaryMin + randInt(200, 1200),
      salaryCurrency: "TND",
      technicalTools: [rand(SKILLS), rand(SKILLS)],
      softSkills: [rand(SKILLS), rand(SKILLS)],
      status: "PUBLISHED" as any,
      publishedAt: new Date(Date.now() - randInt(0, 90) * 86_400_000),
    };
  });

  const jobOfferIds: string[] = [];
  for (let b = 0; b < jobOffersData.length; b += BATCH_SIZE) {
    const batch = jobOffersData.slice(b, b + BATCH_SIZE);
    const created = await Promise.all(batch.map((d) => prisma.jobOffer.create({ data: d })));
    jobOfferIds.push(...created.map((j) => j.id));
    process.stdout.write(`\r  JobOffers: ${jobOfferIds.length}/${JOB_OFFER_COUNT}`);
  }
  console.log(`\r✓ Created ${JOB_OFFER_COUNT} job offers`);

  // Job languages (1–2 per job)
  const seenJobLang = new Set<string>();
  const jobLangRows = jobOfferIds.flatMap((jobOfferId) => {
    const langs = [rand(LANGUAGES)];
    if (Math.random() > 0.5) langs.push(rand(LANGUAGES));
    return [...new Set(langs)].map((language) => {
      const key = `${jobOfferId}:${language}`;
      if (seenJobLang.has(key)) return null;
      seenJobLang.add(key);
      return { jobOfferId, language, level: rand(LANG_LEVELS) as any };
    }).filter(Boolean) as any[];
  });
  await batchInsert("JobLanguages", jobLangRows, (b) => prisma.jobLanguage.createMany({ data: b }));

  // ─────────────────────────────────────────────────────────────────────────
  // CANDIDATES  (10 000)
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\nCreating ${CANDIDATE_COUNT} candidates...`);

  const candidateIds: string[] = [];

  for (let b = 0; b < CANDIDATE_COUNT; b += BATCH_SIZE) {
    const end = Math.min(b + BATCH_SIZE, CANDIDATE_COUNT);

    // 1. Create user rows one by one (need IDs back)
    const userRows = Array.from({ length: end - b }, (_, i) => ({
      email: `candidate${b + i}@cxjobs-seed.com`,
      name: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
      passwordHash,
      role: "CANDIDATE" as const,
      isOnboarded: true,
      emailVerified: new Date(),
    }));

    const createdUsers = await Promise.all(userRows.map((r) => prisma.user.create({ data: r })));

    // 2. Candidate profiles
    const candidateRows = createdUsers.map((u) => {
      const [firstName, ...rest] = u.name!.split(" ");
      return {
        userId: u.id,
        firstName,
        lastName: rest.join(" "),
        headline: rand(JOB_TITLES),
        location: `${rand(TUNISIAN_CITIES)}, Tunisia`,
        phone: `+216 ${randInt(20, 99)} ${randInt(100, 999)} ${randInt(100, 999)}`,
        summary: "Experienced professional seeking new opportunities in Tunisia.",
        targetJobRole: rand(JOB_ROLES) as any,
        preferredJobTypes: [rand(CONTRACT_TYPES)],
        workMode: rand(WORK_MODES) as any,
        shiftType: rand(SHIFT_TYPES) as any,
      };
    });

    const createdCandidates = await Promise.all(
      candidateRows.map((r) => prisma.candidate.create({ data: r }))
    );
    candidateIds.push(...createdCandidates.map((c) => c.id));

    // 3. Skills (2–4 per candidate) — batch
    const skillRows = createdCandidates.flatMap((c) =>
      Array.from({ length: randInt(2, 4) }, () => ({
        candidateId: c.id,
        name: rand(SKILLS),
        level: rand(["BEGINNER","INTERMEDIATE","ADVANCED","EXPERT"]),
        yearsOfExperience: randInt(0, 10),
      }))
    );
    await prisma.candidateSkill.createMany({ data: skillRows });

    // 4. Languages (1–2 per candidate)
    const langRows = createdCandidates.flatMap((c) => {
      const picked = [...new Set([rand(LANGUAGES), rand(LANGUAGES)])];
      return picked.map((name) => ({
        candidateId: c.id,
        name,
        proficiency: rand(["A1","A2","B1","B2","C1","C2","Native"]),
      }));
    });
    await prisma.language.createMany({ data: langRows });

    // 5. Experience (1–2 per candidate)
    const expRows = createdCandidates.flatMap((c) => {
      const count = randInt(1, 2);
      return Array.from({ length: count }, (_, i) => {
        const startYear = 2024 - randInt(1, 8) - i;
        return {
          candidateId: c.id,
          company: `${rand(INDUSTRIES)} Company`,
          title: rand(JOB_TITLES),
          location: `${rand(TUNISIAN_CITIES)}, Tunisia`,
          startDate: new Date(`${startYear}-01-01`),
          endDate: i === 0 ? null : new Date(`${startYear + randInt(1, 3)}-06-01`),
          isCurrent: i === 0,
          description: "Handled customer inquiries and maintained high satisfaction scores.",
        };
      });
    });
    await prisma.experience.createMany({ data: expRows });

    process.stdout.write(`\r  Candidates: ${candidateIds.length}/${CANDIDATE_COUNT}`);
  }
  console.log(`\r✓ Created ${CANDIDATE_COUNT} candidates`);

  // ─────────────────────────────────────────────────────────────────────────
  // APPLICATIONS  (50 000)
  // Must respect the unique constraint: (candidateId, jobOfferId)
  // Strategy: iterate and track seen pairs.
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\nCreating ${APPLICATION_COUNT} applications...`);

  const seen = new Set<string>();
  const applicationRows: {
    candidateId: string;
    jobOfferId: string;
    status: any;
    coverLetter: string;
  }[] = [];

  // Maximum unique pairs = 10_000 × 400 = 4_000_000, so 50_000 is very feasible
  let attempts = 0;
  const maxAttempts = APPLICATION_COUNT * 5;

  while (applicationRows.length < APPLICATION_COUNT && attempts < maxAttempts) {
    attempts++;
    const candidateId = candidateIds[randInt(0, candidateIds.length - 1)];
    const jobOfferId = jobOfferIds[randInt(0, jobOfferIds.length - 1)];
    const key = `${candidateId}:${jobOfferId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    applicationRows.push({
      candidateId,
      jobOfferId,
      status: rand(APP_STATUSES),
      coverLetter: rand(COVER_LETTERS),
    });
  }

  await batchInsert(
    "Applications",
    applicationRows,
    (batch) => prisma.application.createMany({ data: batch }),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n✅ Seed completed successfully!");
  console.log("\n📊 Summary:");
  console.log(`  Companies  : ${COMPANY_COUNT}`);
  console.log(`  Candidates : ${CANDIDATE_COUNT}`);
  console.log(`  Job Offers : ${JOB_OFFER_COUNT}`);
  console.log(`  Applications: ${applicationRows.length}`);
  console.log("\n📧 Test Credentials (password: 12345678):");
  console.log("  Admin     : admin@cxjobs.com");
  console.log("  Company   : company0@cxjobs-seed.com  …  company99@cxjobs-seed.com");
  console.log("  Candidate : candidate0@cxjobs-seed.com  …  candidate9999@cxjobs-seed.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });