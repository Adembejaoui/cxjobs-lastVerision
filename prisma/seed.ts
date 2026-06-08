import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BenefitCategory, BenefitScope } from "../app/generated/prisma/client";
import { createClient } from "@supabase/supabase-js";
import https from "https";
import http from "http";
import path from "node:path";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PASSWORD = "12345678";

function download(url: string, tries = 3): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const start = url.startsWith("https") ? https : http;
      const req = start.get(url, (res) => {
        if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400 && res.headers.location) {
          url = res.headers.location;
          req.destroy();
          return attempt();
        }
        if (res.statusCode && res.statusCode >= 400) {
          if (tries > 1) {
            tries--;
            setTimeout(attempt, 500);
            return;
          }
          return reject(new Error("http " + res.statusCode + " for " + url));
        }
        const chunks: Buffer[] = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      });
      req.on("error", reject);
      req.setTimeout(45000, () => {
        req.destroy();
        if (tries > 1) {
          tries--;
          setTimeout(attempt, 500);
        } else {
          reject(new Error("timeout"));
        }
      });
    };
    attempt();
  });
}

function uploadToSupabase(bucket: string, userId: string, filename: string, buffer: Buffer) {
  return supabase.storage.from(bucket).upload(`${userId}/${filename}`, buffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
}

function publicUrl(bucket: string, userId: string, filename: string): string {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  return `https://${url.host}/storage/v1/object/public/${bucket}/${userId}/${filename}`;
}

const companyConfigs = [
  {
    email: "company1@cxjobs.com",
    name: "TechNova Innovations",
    slug: "technova-innovations",
    industry: "Technology & Software",
    companySize: "MEDIUM",
    location: "Paris, France",
    website: "https://technova.example.com",
    foundedYear: 2015,
    description:
      "TechNova Innovations is a fast-growing software company specializing in cloud solutions, AI-driven analytics, and enterprise digital transformation.",
    mission:
      "To empower organizations worldwide with innovative, secure, and scalable digital solutions that drive growth and efficiency.",
    isRemoteFriendly: true,
    isHybridFriendly: true,
    linkedinUrl: "https://linkedin.com/company/technova",
    twitterUrl: "https://twitter.com/technova",
    logoImageUrl: "https://images.unsplash.com/photo-1618761714954-e0c8445e0c8e?w=400&h=400&fit=crop",
    coverImageUrl: "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1200&h=400&fit=crop",
    cultureImageUrls: [
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&h=500&fit=crop",
    ],
    cultureTitles: ["Diversity & Inclusion", "Innovation First", "Work-Life Harmony", "Continuous Growth"],
    cultureDescriptions: [
      "We celebrate differences and foster an inclusive environment where everyone belongs.",
      "We encourage bold ideas and give teams the autonomy to experiment and iterate.",
      "Results matter more than hours. We trust our team to deliver while maintaining balance.",
      "Learning is in our DNA. We invest in upskilling and career development for all.",
    ],
  },
  {
    email: "company2@cxjobs.com",
    name: "GreenLeaf Solutions",
    slug: "greenleaf-solutions",
    industry: "Sustainability & CleanTech",
    companySize: "LARGE",
    location: "Lyon, France",
    website: "https://greenleaf.example.com",
    foundedYear: 2010,
    description:
      "GreenLeaf Solutions is a pioneering clean technology company focused on renewable energy, sustainable agriculture, and environmental consulting.",
    mission:
      "To accelerate the global transition to sustainability through innovation, education, and action.",
    isRemoteFriendly: true,
    isHybridFriendly: false,
    linkedinUrl: "https://linkedin.com/company/greenleaf",
    twitterUrl: "https://twitter.com/greenleaf",
    logoImageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&h=400&fit=crop",
    coverImageUrl: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&h=400&fit=crop",
    cultureImageUrls: [
      "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=500&fit=crop",
    ],
    cultureTitles: ["Environmental Stewardship", "Collaborative Spirit", "Transparent Communication", "Celebrating Wins"],
    cultureDescriptions: [
      "Every decision considers our planetary impact. Sustainability is our purpose.",
      "Cross-functional teams work closely together, breaking silos to solve big challenges.",
      "Open forums, public dashboards, and regular all-hands keep us aligned.",
      "From small milestones to major product launches, we recognize and celebrate success.",
    ],
  },
];

const benefitsConfigs = [
  [
    { name: "Comprehensive Health Insurance", description: "Full medical, dental, and vision coverage for employees and their families.", category: BenefitCategory.HEALTH, scope: BenefitScope.CORE, icon: "🏥" },
    { name: "Generous Retirement Plan", description: "401(k) matching to help you build a secure financial future.", category: BenefitCategory.FINANCIAL, scope: BenefitScope.CORE, icon: "💰" },
    { name: "Flexible Work Hours", description: "No rigid 9-to-5. Set your schedule to fit your lifestyle and peak productivity.", category: BenefitCategory.WORK_LIFE_BALANCE, scope: BenefitScope.ADDITIONAL, icon: "⏰" },
    { name: "Continuous Learning Budget", description: "Annual stipend for courses, conferences, certifications, and books.", category: BenefitCategory.CAREER_GROWTH, scope: BenefitScope.ADDITIONAL, icon: "📚" },
    { name: "Modern Office & Amenities", description: "State-of-the-art office with free snacks, standing desks, and relaxation zones.", category: BenefitCategory.WORK_ENVIRONMENT, scope: BenefitScope.CORE, icon: "🖥️" },
    { name: "Mental Wellness Support", description: "Free therapy sessions, meditation subscriptions, and mental health days.", category: BenefitCategory.HEALTH, scope: BenefitScope.ADDITIONAL, icon: "🧠" },
    { name: "Annual Performance Bonus", description: "Performance-based quarterly bonuses and annual profit-sharing.", category: BenefitCategory.FINANCIAL, scope: BenefitScope.ADDITIONAL, icon: "🎁" },
    { name: "Remote Work Stipend", description: "Monthly stipend for home office setup, internet, and co-working spaces.", category: BenefitCategory.WORK_ENVIRONMENT, scope: BenefitScope.ADDITIONAL, icon: "🏠" },
  ],
  [
    { name: "Premium Medical Coverage", description: "World-class health insurance including mental health and wellness programs.", category: BenefitCategory.HEALTH, scope: BenefitScope.CORE, icon: "🏥" },
    { name: "Equity & Stock Options", description: "Industry-leading equity plan that makes every employee a stakeholder.", category: BenefitCategory.FINANCIAL, scope: BenefitScope.CORE, icon: "📈" },
    { name: "Generous PTO Policy", description: "Unlimited paid time off with a minimum of 25 days encouraged annually.", category: BenefitCategory.WORK_LIFE_BALANCE, scope: BenefitScope.CORE, icon: "🏖️" },
    { name: "Tuition Reimbursement", description: "Up to 100% reimbursement for relevant higher education and professional courses.", category: BenefitCategory.CAREER_GROWTH, scope: BenefitScope.ADDITIONAL, icon: "🎓" },
    { name: "Eco-Friendly Office Design", description: "Our LEED-certified offices use sustainable materials, natural light, and green spaces aplenty.", category: BenefitCategory.WORK_ENVIRONMENT, scope: BenefitScope.CORE, icon: "🌿" },
    { name: "Wellness & Fitness Programs", description: "On-site gym, yoga classes, running club, and wellness challenges.", category: BenefitCategory.HEALTH, scope: BenefitScope.ADDITIONAL, icon: "🧘" },
    { name: "Profit-Sharing Plan", description: "Annual profit-sharing distributed equitably across all employees.", category: BenefitCategory.FINANCIAL, scope: BenefitScope.ADDITIONAL, icon: "🤝" },
    { name: "4-Day Work Week Pilot", description: "Participate in our ongoing 4-day work week trial with full pay and benefits.", category: BenefitCategory.WORK_LIFE_BALANCE, scope: BenefitScope.ADDITIONAL, icon: "🕓" },
  ],
];

async function seed() {
  console.log("\n--- Seed start ---\n");

  const emails = companyConfigs.map((c) => c.email);
  const slugs = companyConfigs.map((c) => c.slug);

  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    include: { companies: { include: { benefits: true, jobs: true } } },
  });
  for (const u of existing) {
    if (u.companies) {
      const c = u.companies;
      await prisma.companyBenefit.deleteMany({ where: { companyId: c.id } });
      await prisma.jobOffer.deleteMany({ where: { companyId: c.id } });
      await prisma.companies.delete({ where: { id: c.id } });
    }
    await prisma.user.delete({ where: { id: u.id } });
  }
  const slugCompanies = await prisma.companies.findMany({ where: { slug: { in: slugs } } });
  for (const c of slugCompanies) {
    await prisma.companyBenefit.deleteMany({ where: { companyId: c.id } });
    await prisma.jobOffer.deleteMany({ where: { companyId: c.id } });
    await prisma.companies.delete({ where: { id: c.id } });
  }
  console.log(`Cleaned ${existing.length + slugCompanies.length} existing entries.`);

  for (const [idx, cfg] of companyConfigs.entries()) {
    console.log(`\n🚀 Seeding ${cfg.name} (${cfg.email})`);

    const user = await prisma.user.create({
      data: {
        email: cfg.email,
        name: cfg.name,
        role: "COMPANY",
        passwordHash: bcrypt.hashSync(PASSWORD, 10),
        isOnboarded: true,
      },
    });
    console.log(`  User created: ${user.email}`);

    const logoFilename = path.basename(new URL(cfg.logoImageUrl).pathname).split("?")[0] || "logo.jpg";
    let logoUrl = publicUrl("logos", user.id, logoFilename);
    try {
      const logoBuffer = await download(cfg.logoImageUrl);
      await uploadToSupabase("logos", user.id, logoFilename, logoBuffer);
      console.log(`  Logo uploaded: ${logoUrl}`);
    } catch (e) {
      console.warn(`  Logo upload failed, using fallback URL: ${e instanceof Error ? e.message : e}`);
      logoUrl = cfg.logoImageUrl;
    }

    const coverFilename = path.basename(new URL(cfg.coverImageUrl).pathname).split("?")[0] || "cover.jpg";
    let coverUrl = publicUrl("covers", user.id, coverFilename);
    try {
      const coverBuffer = await download(cfg.coverImageUrl);
      await uploadToSupabase("covers", user.id, coverFilename, coverBuffer);
      console.log(`  Cover uploaded: ${coverUrl}`);
    } catch (e) {
      console.warn(`  Cover upload failed, using fallback URL: ${e instanceof Error ? e.message : e}`);
      coverUrl = cfg.coverImageUrl;
    }

    const cultureItems = [];
    for (let c = 0; c < cfg.cultureTitles.length; c++) {
      const imageUrl = cfg.cultureImageUrls[c];
      let uploadedUrl = imageUrl;
      try {
        const cultureFilename = `culture-${c + 1}.jpg`;
        const cultureBuffer = await download(imageUrl);
        await uploadToSupabase("culture-images", user.id, cultureFilename, cultureBuffer);
        uploadedUrl = publicUrl("culture-images", user.id, cultureFilename);
        console.log(`  Culture image ${c + 1} uploaded to DB`);
      } catch (e) {
        console.warn(`  Culture image ${c + 1} using Unsplash URL (no upload): ${e instanceof Error ? e.message : e}`);
      }
      cultureItems.push({
        title: cfg.cultureTitles[c],
        description: cfg.cultureDescriptions[c],
        imageUrl: uploadedUrl,
        icon: ["🌈", "💡", "⚖️", "🚀"][c],
      });
    }

    const company = await prisma.companies.create({
      data: {
        userId: user.id,
        name: cfg.name,
        slug: cfg.slug,
        logoUrl: logoUrl,
        coverImageUrl: coverUrl,
        industry: cfg.industry,
        companySize: cfg.companySize,
        location: cfg.location,
        website: cfg.website,
        foundedYear: cfg.foundedYear,
        description: cfg.description,
        mission: cfg.mission,
        culture: JSON.stringify(cultureItems),
        isRemoteFriendly: cfg.isRemoteFriendly,
        isHybridFriendly: cfg.isHybridFriendly,
        linkedinUrl: cfg.linkedinUrl,
        twitterUrl: cfg.twitterUrl,
        isVerified: true,
        verifiedAt: new Date(),
        subscriptionPlan: "FREE",
        count: {
          create: {
            jobs: 0,
            employees: 150,
            followers: 420,
          },
        },
        benefits: {
          create: benefitsConfigs[idx].map((b) => ({
            name: b.name,
            description: b.description,
            category: b.category,
            scope: b.scope,
            icon: b.icon,
          })),
        },
      },
    });

    console.log(`  Company created: ${company.name} | slug: ${company.slug}`);
    console.log(`  Benefits: ${benefitsConfigs[idx].length}`);
    console.log(`  Culture items: ${cultureItems.length}`);
  }

  console.log("\n🎉 Seed completed successfully.\n");
}

seed()
  .catch((err) => {
    console.error("\n❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
