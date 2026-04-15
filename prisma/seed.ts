import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ["error"],
});

async function main() {
  console.log("🌱 Starting database seed...");

  // Note: ApplicationMessage, CompanyInvitation, Blog, JobAlert, Notification, NotificationPreference models were removed from schema - skipping delete
  await prisma.application.deleteMany();
  await prisma.jobOfferBenefit.deleteMany();
  await prisma.jobLanguage.deleteMany();
  await prisma.jobOffer.deleteMany();
  await prisma.companyBenefit.deleteMany();
  await prisma.companyCount.deleteMany();
  await prisma.company.deleteMany();
  await prisma.candidateSkill.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.education.deleteMany();
  await prisma.language.deleteMany();
  // await prisma.jobAlert.deleteMany();
  await prisma.candidate.deleteMany();
  // await prisma.notification.deleteMany();
  // await prisma.notificationPreference.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();

  console.log("✓ Cleaned existing data");

  const passwordHash = await bcrypt.hash("12345678", 12);

  // Create Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@cxjobs.com",
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
      isOnboarded: true,
      emailVerified: new Date(),
    },
  });
  console.log("✓ Created admin user:", admin.email);

  // Create Company Users
  const companyUsers = await Promise.all([
    { email: "techcorp@company.com", name: "TechCorp HR" },
    { email: "callcenter@company.com", name: "CallCenter Plus HR" },
    { email: "customer@company.com", name: "CustomerFirst HR" },
  ].map(async (user) => {
    return prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: "COMPANY",
        isOnboarded: true,
        emailVerified: new Date(),
      },
    });
  }));

  // Create Companies
  const companies = await Promise.all([
    prisma.company.create({
      data: {
        userId: companyUsers[0].id,
        name: "TechCorp Solutions",
        slug: "techcorp-solutions",
        description: "A leading technology company specializing in AI and cloud solutions for call centers.",
        industry: "Technology",
        companySize: "201-500",
        location: "Tunis, Tunisia",
        website: "https://techcorp.example.com",
        linkedinUrl: "https://linkedin.com/company/techcorp",
        culture: JSON.stringify([
          { title: "Innovation", description: "We push boundaries every day" },
          { title: "Teamwork", description: "Collaboration is key to our success" },
        ]),
        isRemoteFriendly: true,
        isHybridFriendly: true,
        subscriptionPlan: "PREMIUM",
      },
    }),
    prisma.company.create({
      data: {
        userId: companyUsers[1].id,
        name: "CallCenter Plus",
        slug: "callcenter-plus",
        description: "Premier call center services for banking and telecom sectors.",
        industry: "Call Center",
        companySize: "501-1000",
        location: "Sfax, Tunisia",
        website: "https://callcenterplus.example.com",
        linkedinUrl: "https://linkedin.com/company/callcenterplus",
        culture: JSON.stringify([
          { title: "Customer Focus", description: "Customer satisfaction is our priority" },
          { title: "Professionalism", description: "We maintain highest standards" },
        ]),
        isHybridFriendly: true,
        subscriptionPlan: "GROW",
      },
    }),
    prisma.company.create({
      data: {
        userId: companyUsers[2].id,
        name: "CustomerFirst",
        slug: "customerfirst",
        description: "Leading customer service outsourcing company.",
        industry: "Customer Service",
        companySize: "51-200",
        location: "Ariana, Tunisia",
        website: "https://customerfirst.example.com",
        linkedinUrl: "https://linkedin.com/company/customerfirst",
        culture: JSON.stringify([
          { title: "Excellence", description: "We strive for excellence in every interaction" },
          { title: "Growth", description: "Continuous learning and development" },
        ]),
        isRemoteFriendly: true,
        subscriptionPlan: "ESSENTIAL",
      },
    }),
  ]);

  // Create Company Counts
  await Promise.all([
    prisma.companyCount.create({ data: { companyId: companies[0].id, jobs: 0, employees: 250, followers: 1500 } }),
    prisma.companyCount.create({ data: { companyId: companies[1].id, jobs: 0, employees: 600, followers: 3000 } }),
    prisma.companyCount.create({ data: { companyId: companies[2].id, jobs: 0, employees: 80, followers: 400 } }),
  ]);

  // Create Company Benefits
  await Promise.all([
    prisma.companyBenefit.createMany({
      data: [
        { companyId: companies[0].id, name: "Health Insurance", description: "Comprehensive medical coverage", icon: "heart", category: "HEALTH", scope: "CORE" },
        { companyId: companies[0].id, name: "Remote Work", description: "Work from anywhere", icon: "home", category: "WORK_ENVIRONMENT", scope: "CORE" },
        { companyId: companies[0].id, name: "Learning Budget", description: "2000 TND annual budget", icon: "book", category: "CAREER_GROWTH", scope: "ADDITIONAL" },
        { companyId: companies[1].id, name: "Transport Allowance", description: "Monthly transport补贴", icon: "car", category: "FINANCIAL", scope: "CORE" },
        { companyId: companies[1].id, name: "Meal Vouchers", description: "Daily meal vouchers", icon: "utensils", category: "WORK_LIFE_BALANCE", scope: "CORE" },
        { companyId: companies[1].id, name: "Performance Bonus", description: "Quarterly performance bonus", icon: "gift", category: "FINANCIAL", scope: "ADDITIONAL" },
        { companyId: companies[2].id, name: "Flexible Hours", description: "Flexible working hours", icon: "clock", category: "WORK_LIFE_BALANCE", scope: "CORE" },
        { companyId: companies[2].id, name: "Remote First", description: "Fully remote option", icon: "home", category: "WORK_ENVIRONMENT", scope: "CORE" },
      ],
    }),
  ]);

  console.log("✓ Created 3 companies with benefits");

  // Create Candidate Users
  const candidateUsers = await Promise.all([
    { email: "ahmed.messaoud@example.com", name: "Ahmed Messaoud" },
    { email: "fatma.benali@example.com", name: "Fatma Ben Ali" },
    { email: "mohamed.khalfi@example.com", name: "Mohamed Khalfi" },
    { email: "sara.mezghich@example.com", name: "Sara Mezghich" },
    { email: "youssef.bouazzi@example.com", name: "Youssef Bouazzi" },
  ].map(async (user) => {
    return prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: "CANDIDATE",
        isOnboarded: true,
        emailVerified: new Date(),
      },
    });
  }));

  // Create Candidates with new fields
  const candidates = await Promise.all([
    prisma.candidate.create({
      data: {
        userId: candidateUsers[0].id,
        firstName: "Ahmed",
        lastName: "Messaoud",
        headline: "Call Center Representative",
        location: "Tunis, Tunisia",
        phone: "+216 12 345 678",
        summary: "Experienced call center agent with 5 years in customer service. Fluent in French and English.",
        targetJobRole: "CALL_CENTER",
        preferredJobTypes: ["FULL_TIME", "CDI"],
        workMode: "HYBRID",
        shiftType: "FLEXIBLE",
      },
    }),
    prisma.candidate.create({
      data: {
        userId: candidateUsers[1].id,
        firstName: "Fatma",
        lastName: "Ben Ali",
        headline: "Customer Service Manager",
        location: "Sfax, Tunisia",
        phone: "+216 23 456 789",
        summary: "Results-driven customer service professional with 7 years experience managing teams.",
targetJobRole: "CUSTOMER_SERVICE",
        preferredJobTypes: ["FULL_TIME", "CDI"],
        workMode: "ONSITE",
        shiftType: "DAY",
      },
    }),
    prisma.candidate.create({
      data: {
        userId: candidateUsers[2].id,
        firstName: "Mohamed",
        lastName: "Khalfi",
        headline: "Technical Support Specialist",
        location: "Ariana, Tunisia",
        phone: "+216 34 567 890",
        summary: "IT support specialist with strong technical skills and customer-oriented approach.",
        targetJobRole: "TECH_SUPPORT",
        preferredJobTypes: ["FULL_TIME", "CDI"],
        workMode: "REMOTE",
        shiftType: "FLEXIBLE",
      },
    }),
    prisma.candidate.create({
      data: {
        userId: candidateUsers[3].id,
        firstName: "Sara",
        lastName: "Mezghich",
        headline: "Sales Representative",
        location: "Tunis, Tunisia",
        phone: "+216 45 678 901",
        summary: "Dynamic sales professional with proven track record in B2B sales.",
        targetJobRole: "SALES",
        preferredJobTypes: ["FULL_TIME", "CDI"],
        workMode: "HYBRID",
        shiftType: "DAY",
      },
    }),
    prisma.candidate.create({
      data: {
        userId: candidateUsers[4].id,
        firstName: "Youssef",
        lastName: "Bouazzi",
        headline: "Administrative Assistant",
        location: "Ben Arous, Tunisia",
        phone: "+216 56 789 012",
        summary: "Organized administrative professional with excellent MS Office skills.",
        targetJobRole: "ADMIN",
        preferredJobTypes: ["FULL_TIME", "PART_TIME"],
        workMode: "ONSITE",
        shiftType: "DAY",
      },
    }),
  ]);

  // Create Candidate Skills
  await Promise.all([
    prisma.candidateSkill.createMany({
      data: [
        { candidateId: candidates[0].id, name: "Communication", level: "Expert" },
        { candidateId: candidates[0].id, name: "French", level: "Fluent" },
        { candidateId: candidates[0].id, name: "English", level: "Advanced" },
        { candidateId: candidates[0].id, name: "CRM", level: "Advanced" },
        { candidateId: candidates[1].id, name: "Team Management", level: "Expert" },
        { candidateId: candidates[1].id, name: "French", level: "Native" },
        { candidateId: candidates[1].id, name: "English", level: "Fluent" },
        { candidateId: candidates[1].id, name: "Customer Relations", level: "Expert" },
        { candidateId: candidates[2].id, name: "Technical Support", level: "Advanced" },
        { candidateId: candidates[2].id, name: "English", level: "Fluent" },
        { candidateId: candidates[2].id, name: "French", level: "Fluent" },
        { candidateId: candidates[2].id, name: "IT Support", level: "Advanced" },
        { candidateId: candidates[3].id, name: "Sales", level: "Expert" },
        { candidateId: candidates[3].id, name: "Negotiation", level: "Expert" },
        { candidateId: candidates[3].id, name: "French", level: "Fluent" },
        { candidateId: candidates[3].id, name: "English", level: "Advanced" },
        { candidateId: candidates[4].id, name: "Microsoft Office", level: "Expert" },
        { candidateId: candidates[4].id, name: "Organization", level: "Advanced" },
        { candidateId: candidates[4].id, name: "French", level: "Native" },
        { candidateId: candidates[4].id, name: "English", level: "Intermediate" },
      ],
    }),
  ]);

  // Create Candidate Languages
  await Promise.all([
    prisma.language.createMany({
      data: [
        { candidateId: candidates[0].id, name: "French", proficiency: "FLUENT" },
        { candidateId: candidates[0].id, name: "English", proficiency: "ADVANCED" },
        { candidateId: candidates[0].id, name: "Arabic", proficiency: "NATIVE" },
        { candidateId: candidates[1].id, name: "Arabic", proficiency: "NATIVE" },
        { candidateId: candidates[1].id, name: "French", proficiency: "FLUENT" },
        { candidateId: candidates[1].id, name: "English", proficiency: "CONVERSATIONAL" },
        { candidateId: candidates[2].id, name: "Arabic", proficiency: "NATIVE" },
        { candidateId: candidates[2].id, name: "French", proficiency: "FLUENT" },
        { candidateId: candidates[2].id, name: "English", proficiency: "FLUENT" },
        { candidateId: candidates[3].id, name: "Arabic", proficiency: "NATIVE" },
        { candidateId: candidates[3].id, name: "French", proficiency: "FLUENT" },
        { candidateId: candidates[3].id, name: "English", proficiency: "ADVANCED" },
        { candidateId: candidates[4].id, name: "Arabic", proficiency: "NATIVE" },
        { candidateId: candidates[4].id, name: "French", proficiency: "FLUENT" },
        { candidateId: candidates[4].id, name: "English", proficiency: "BASIC" },
      ],
    }),
  ]);

  // Create Candidate Experiences
  await Promise.all([
    prisma.experience.createMany({
      data: [
        {
          candidateId: candidates[0].id,
          company: "Telecom Tunisia",
          title: "Call Center Agent",
          location: "Tunis",
          startDate: new Date("2020-01-15"),
          isCurrent: true,
          description: "Handling customer inquiries and resolving issues"
        },
        {
          candidateId: candidates[1].id,
          company: "Banque Zitouna",
          title: "Customer Service Manager",
          location: "Tunis",
          startDate: new Date("2018-06-01"),
          isCurrent: true,
          description: "Managing a team of 15 customer service representatives"
        },
        {
          candidateId: candidates[2].id,
          company: "Globenet",
          title: "Technical Support Engineer",
          location: "Sfax",
          startDate: new Date("2021-03-01"),
          endDate: new Date("2024-12-31"),
          isCurrent: false,
          description: "Providing technical support for software products"
        },
      ],
    }),
  ]);

  console.log("✓ Created 5 candidates with skills, languages, and experience");

  // Create Job Offers
  const jobOffers = await Promise.all([
    // TechCorp Jobs
    prisma.jobOffer.create({
      data: {
        companyId: companies[0].id,
        title: "Call Center Agent - French Speaking",
        slug: "call-center-agent-french-techcorp",
        description: "We are looking for a motivated Call Center Agent to join our French-speaking team. You will handle customer inquiries and provide excellent support.",
        contractType: "CDI",
        isRemote: false,
        isHybrid: true,
        experienceLevel: "JUNIOR",
        salaryMin: 1200,
        salaryMax: 1800,
        salaryCurrency: "TND",
        requirements: ["French fluency", "Good communication skills", "Customer service orientation"],
        technicalTools: ["CRM", "Ticketing System"],
        softSkills: ["Communication", "Patience", "Problem Solving"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    prisma.jobOffer.create({
      data: {
        companyId: companies[0].id,
        title: "Technical Support Specialist",
        slug: "technical-support-specialist-techcorp",
        description: "Join our tech support team to help customers resolve technical issues.",
        contractType: "CDI",
        isRemote: true,
        isHybrid: false,
        experienceLevel: "MID",
        salaryMin: 1800,
        salaryMax: 2500,
        salaryCurrency: "TND",
        requirements: ["Technical background", "French and English", "Problem-solving skills"],
        technicalTools: ["Remote Desktop", "Ticketing System"],
        softSkills: ["Technical Knowledge", "Communication"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    // CallCenter Plus Jobs
    prisma.jobOffer.create({
      data: {
        companyId: companies[1].id,
        title: "Customer Service Representative",
        slug: "customer-service-rep-callcenterplus",
        description: "Handle customer inquiries for our banking client. Professional environment with growth opportunities.",
        contractType: "CDI",
        isRemote: false,
        isHybrid: true,
        experienceLevel: "JUNIOR",
        salaryMin: 1000,
        salaryMax: 1500,
        salaryCurrency: "TND",
        requirements: ["French fluency", "High school diploma", "Good interpersonal skills"],
        technicalTools: ["Banking CRM"],
        softSkills: ["Communication", "Active Listening"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    prisma.jobOffer.create({
      data: {
        companyId: companies[1].id,
        title: "Team Lead - Call Center",
        slug: "team-lead-callcenter-callcenterplus",
        description: "Lead a team of call center agents. Manage performance and ensure quality service.",
        contractType: "CDI",
        isRemote: false,
        isHybrid: false,
        experienceLevel: "SENIOR",
        salaryMin: 2500,
        salaryMax: 3500,
        salaryCurrency: "TND",
        requirements: ["3+ years call center experience", "Team management", "French fluency"],
        technicalTools: ["CRM", "Reporting Tools"],
        softSkills: ["Leadership", "Team Management", "Communication"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    prisma.jobOffer.create({
      data: {
        companyId: companies[1].id,
        title: "Inbound Sales Specialist",
        slug: "inbound-sales-specialist-callcenterplus",
        description: "Handle inbound sales calls and convert inquiries into sales.",
        contractType: "CDI",
        isRemote: false,
        isHybrid: true,
        experienceLevel: "MID",
        salaryMin: 1500,
        salaryMax: 2000,
        salaryCurrency: "TND",
        requirements: ["Sales experience", "French fluency", "Target-oriented"],
        technicalTools: ["Sales CRM"],
        softSkills: ["Sales", "Negotiation", "Communication"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    // CustomerFirst Jobs
    prisma.jobOffer.create({
      data: {
        companyId: companies[2].id,
        title: "Chat Support Agent",
        slug: "chat-support-agent-customerfirst",
        description: "Provide customer support via live chat. Remote work opportunity.",
        contractType: "CDI",
        isRemote: true,
        isHybrid: false,
        experienceLevel: "JUNIOR",
        salaryMin: 1000,
        salaryMax: 1400,
        salaryCurrency: "TND",
        requirements: ["French writing skills", "Fast typing", "Customer service mindset"],
        technicalTools: ["Live Chat Platform", "CRM"],
        softSkills: ["Written Communication", "Time Management"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    prisma.jobOffer.create({
      data: {
        companyId: companies[2].id,
        title: "Administrative Assistant",
        slug: "admin-assistant-customerfirst",
        description: "Support our operations team with administrative tasks.",
        contractType: "CDI",
        isRemote: false,
        isHybrid: true,
        experienceLevel: "MID",
        salaryMin: 1400,
        salaryMax: 1800,
        salaryCurrency: "TND",
        requirements: ["MS Office proficiency", "Organization skills", "French fluency"],
        technicalTools: ["Microsoft Office", "ERP System"],
        softSkills: ["Organization", "Time Management", "Communication"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    // More TechCorp Jobs
    prisma.jobOffer.create({
      data: {
        companyId: companies[0].id,
        title: "Night Shift Call Center Agent",
        slug: "night-shift-agent-techcorp",
        description: "Handle overnight customer inquiries for international clients.",
        contractType: "CDI",
        isRemote: false,
        isHybrid: false,
        experienceLevel: "JUNIOR",
        salaryMin: 1400,
        salaryMax: 2000,
        salaryCurrency: "TND",
        requirements: ["French fluency", "Night shift availability", "Customer service skills"],
        technicalTools: ["CRM", "Communication Tools"],
        softSkills: ["Communication", "Adaptability"],
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
  ]);

  // Create Job Languages
  await prisma.jobLanguage.createMany({
    data: [
      { jobOfferId: jobOffers[0].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[0].id, language: "English", level: "PREFERRED" },
      { jobOfferId: jobOffers[1].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[1].id, language: "English", level: "REQUIRED" },
      { jobOfferId: jobOffers[2].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[3].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[4].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[5].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[6].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[7].id, language: "French", level: "REQUIRED" },
      { jobOfferId: jobOffers[7].id, language: "English", level: "REQUIRED" },
    ],
  });

  console.log("✓ Created 8 job offers with languages");

  // Create 10 Applications
  const applications = await Promise.all([
    prisma.application.create({
      data: {
        candidateId: candidates[0].id,
        jobOfferId: jobOffers[0].id,
        status: "NOUVEAU",
        coverLetter: "I'm excited about this opportunity to work in a dynamic call center environment.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[0].id,
        jobOfferId: jobOffers[2].id,
        status: "EN_COURS_EXAMEN",
        coverLetter: "With my call center experience, I believe I would be a great fit for this role.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[1].id,
        jobOfferId: jobOffers[3].id,
        status: "ENTRETIEN",
        coverLetter: "I'm passionate about team leadership and customer satisfaction.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[2].id,
        jobOfferId: jobOffers[1].id,
        status: "NOUVEAU",
        coverLetter: "My technical background and customer service skills make me a good candidate.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[3].id,
        jobOfferId: jobOffers[4].id,
        status: "ENTRETIEN",
        coverLetter: "I'm eager to use my sales skills in a dynamic call center environment.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[4].id,
        jobOfferId: jobOffers[6].id,
        status: "NOUVEAU",
        coverLetter: "My administrative skills and organization make me a strong candidate.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[0].id,
        jobOfferId: jobOffers[7].id,
        status: "EMBAUCHES",
        coverLetter: "I'm available for night shifts and eager to join your team.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[1].id,
        jobOfferId: jobOffers[2].id,
        status: "EN_COURS_EXAMEN",
        coverLetter: "Looking forward to contributing to your customer service team.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[2].id,
        jobOfferId: jobOffers[5].id,
        status: "NOUVEAU",
        coverLetter: "Chat support is an area I'm very interested in exploring.",
      },
    }),
    prisma.application.create({
      data: {
        candidateId: candidates[3].id,
        jobOfferId: jobOffers[0].id,
        status: "REFUSE",
        coverLetter: "Very interested in call center opportunities.",
      },
    }),
  ]);

  console.log("✓ Created 10 applications");

  console.log("\n✅ Seed completed successfully!");
  console.log("\n📧 Test Credentials:");
  console.log("Admin: admin@cxjobs.com / 12345678");
  console.log("Companies: techcorp@company.com / 12345678");
  console.log("  callcenter@company.com / 12345678");
  console.log("  customer@company.com / 12345678");
  console.log("Candidates: ahmed.messaoud@example.com / 12345678");
  console.log("  fatma.benali@example.com / 12345678");
  console.log("  mohamed.khalfi@example.com / 12345678");
  console.log("  sara.mezghich@example.com / 12345678");
  console.log("  youssef.bouazzi@example.com / 12345678");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
