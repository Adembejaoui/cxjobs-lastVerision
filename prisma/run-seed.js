"use strict";

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient, BenefitCategory, BenefitScope } = require("../app/generated/prisma/client");
const { createClient } = require("@supabase/supabase-js");
const https = require("https");
const http = require("http");
const path = require("path");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PASSWORD = "12345678";

function download(url, cb) {
  const t0 = Date.now();
  const start = url.startsWith("https") ? https : http;
  const req = start.get(url, (res) => {
    if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400 && res.headers.location) {
      return download(res.headers.location, cb);
    }
    if (res.statusCode && res.statusCode >= 400) {
      return cb(new Error("http " + res.statusCode));
    }
    const c = [];
    res.on("data", (d) => c.push(d));
    res.on("end", () => {
      console.log("  downloaded", Buffer.concat(c).length, "bytes in", Math.round((Date.now() - t0) / 1000), "s");
      cb(Buffer.concat(c));
    });
  });
  req.on("error", cb);
  req.setTimeout(45000, () => {
    req.destroy();
    cb(new Error("timeout"));
  });
}

function upload(bucket, userId, name, buf) {
  const filepath = `${userId}/${name}`;
  return supabase.storage.from(bucket).upload(filepath, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });
}

function assets(base, i) {
  return {
    logo: base + logoSuffix(i),
    cover: base + coverSuffix(i),
    culture: [
      "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop",
      "https://images.unsplash.com/photo-1497215842964-222b430dc094?w=800&h=500&fit=crop",
    ][i % 4],
  };
}
function logoSuffix(i) {
  return [
    "photo-1618761714954-e0c8445e0c8e?w=400&h=400&fit=crop",
    "photo-1542601906990-b4d3fb778b09?w=400&h=400&fit=crop",
  ][i];
}
function coverSuffix(i) {
  return [
    "photo-1497215842964-222b430dc094?w=1200&h=400&fit=crop",
    "photo-1470071459604-3b5ec3a7fe05?w=1200&h=400&fit=crop",
  ][i];
}

async function run() {
  console.log("\n--- seed start ---");
  // remove anything that could collide
  const emails = ["company0@cxjobs.com", "company1@cxjobs.com"];
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    include: { companies: { include: { count: true, benefits: true, jobs: true } } },
  });
  for (const u of users) {
    const c = u.companies;
    if (c) {
      await prisma.companyBenefit.deleteMany({ where: { companyId: c.id } });
      await prisma.jobOffer.deleteMany({ where: { companyId: c.id } });
      await prisma.companies.delete({ where: { id: c.id } });
    }
    await prisma.user.delete({ where: { id: u.id } });
  }
  console.log("cleaned");

  for (let i = 0; i < 2; i++) {
    const name = ["TechNova Innovations", "GreenLeaf Solutions"][i];
    const slug = ["technova-innovations", "greenleaf-solutions"][i];
    const email = `company${i}@cxjobs.com`;
    const a = assets("https://images.unsplash.com/", i);

    console.log("\n== " + name + " ==");
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: "COMPANY",
        passwordHash: bcrypt.hashSync(PASSWORD, 10),
        isOnboarded: true,
      },
    });
    console.log("created user", user.email);

    const assets1 = [
      { url: "https://images.unsplash.com/" + a.logo, bucket: STORAGE_LOGO, filename: "logo.jpg" },
      { url: "https://images.unsplash.com/" + a.cover, bucket: STORAGE_COVER, filename: "cover.jpg" },
    ];
    let logoUrl = null;
    for (const as of assets1) {
      await new Promise((res, rej) => {
        download(as.url, async (buf) => {
          if (buf instanceof Error) return rej(buf);
          const { error } = await upload(as.bucket, user.id, as.filename, buf);
          if (error) return rej(error);
          if (as.bucket === STORAGE_LOGO) {
            logoUrl = `${publicBucketUrl(as.bucket)}/${user.id}/${as.filename}`;
          }
          console.log("uploaded", as.bucket, as.filename);
          res();
        });
      });
    }
    if (!logoUrl) throw new Error("logoUrl missing");

    const coverUrl = `${publicBucketUrl(STORAGE_COVER)}/${user.id}/cover.jpg`;
    const cultureItems = [];
    // culture images: real uploaded URL for first, others keep fallback for speed
    const firstCulture = new URL("https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&h=500&fit=crop");
    await new Promise((res, rej) => {
      download(firstCulture.toString(), async (buf) => {
        if (buf instanceof Error) return rej(buf);
        const filename = "culture-1.jpg";
        await upload("culture-images", user.id, filename, buf);
        const uploaded = `${publicBucketUrl("culture-images")}/${user.id}/${filename}`;
        console.log("uploaded culture 1");
        cultureItems.push({
          title: "Diversity & Inclusion",
          description: "We celebrate differences and foster an inclusive environment where everyone belongs.",
          imageUrl: uploaded,
          icon: "🌈",
        });
        res();
      });
    });

    const benefitsData = benefitsFor(name);
    const company = await prisma.companies.create({
      data: {
        userId: user.id,
        name,
        slug,
        logoUrl,
        coverImageUrl: coverUrl,
        industry: i === 0 ? "Technology & Software" : "Sustainability & CleanTech",
        companySize: i === 0 ? "MEDIUM" : "LARGE",
        location: i === 0 ? "Paris, France" : "Lyon, France",
        website: name.toLowerCase().replace(/\s+/g, "") + ".example.com",
        foundedYear: i === 0 ? 2015 : 2010,
        description: descriptionFor(name),
        mission: missionFor(name),
        culture: JSON.stringify(cultureItems),
        isRemoteFriendly: true,
        isHybridFriendly: i === 0,
        linkedinUrl: "https://linkedin.com/company/" + slug,
        twitterUrl: "https://twitter.com/" + slug,
        isVerified: true,
        verifiedAt: new Date(),
        count: { create: { jobs: 0, employees: 0, followers: 0 } },
        benefits: {
          create: benefitsData.map((b) => ({
            name: b.name,
            description: b.description,
            category: b.category,
            scope: b.scope,
            icon: b.icon,
          })),
        },
      },
    });
    console.log("inserted company", company.name, "benefits", benefitsData.length);
  }

  console.log("\n--- seed done ---");
  await prisma.$disconnect();
}

function publicBucketUrl(bucket) {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL +
    "/storage/v1/object/public/" +
    bucket.replace("logos", STORAGE_LOGO)
      .replace("covers", STORAGE_COVER)
      .replace("culture-images", "culture-images")
  );
  // Use explicit map to avoid regex surprises:
  const m = {
    logos: STORAGE_LOGO,
    covers: STORAGE_COVER,
    "culture-images": "culture-images",
  }[bucket];
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${m}`;
}

const STORAGE_LOGO = "logos";
const STORAGE_COVER = "covers";

function benefitsFor(name) {
  const base = [
    {
      name: "Comprehensive Health Insurance",
      description: "Full medical, dental, and vision coverage for employees and their families.",
      category: BenefitCategory.HEALTH,
      scope: BenefitScope.CORE,
      icon: "🏥",
    },
    {
      name: "Generous Retirement Plan",
      description: "401(k) matching to help you build a secure financial future.",
      category: BenefitCategory.FINANCIAL,
      scope: BenefitScope.CORE,
      icon: "💰",
    },
    {
      name: "Flexible Work Hours",
      description: "No rigid 9-to-5. Set your schedule to fit your lifestyle and peak productivity.",
      category: BenefitCategory.WORK_LIFE_BALANCE,
      scope: BenefitScope.ADDITIONAL,
      icon: "⏰",
    },
    {
      name: "Continuous Learning Budget",
      description: "Annual stipend for courses, conferences, certifications, and books.",
      category: BenefitCategory.CAREER_GROWTH,
      scope: BenefitScope.ADDITIONAL,
      icon: "📚",
    },
    {
      name: "Modern Office & Amenities",
      description: "State-of-the-art office with free snacks, standing desks, and relaxation zones.",
      category: BenefitCategory.WORK_ENVIRONMENT,
      scope: BenefitScope.CORE,
      icon: "🖥️",
    },
    {
      name: "Mental Wellness Support",
      description: "Free therapy sessions, meditation subscriptions, and mental health days.",
      category: BenefitCategory.HEALTH,
      scope: BenefitScope.ADDITIONAL,
      icon: "🧠",
    },
    {
      name: "Annual Performance Bonus",
      description: "Performance-based quarterly bonuses and annual profit-sharing.",
      category: BenefitCategory.FINANCIAL,
      scope: BenefitScope.ADDITIONAL,
      icon: "🎁",
    },
    {
      name: "Remote Work Stipend",
      description: "Monthly stipend for home office setup, internet, and co-working spaces.",
      category: BenefitCategory.WORK_ENVIRONMENT,
      scope: BenefitScope.ADDITIONAL,
      icon: "🏠",
    },
  ];
  if (name.includes("GreenLeaf")) {
    return base.map((b) => {
      if (b.name.includes("Generous Retirement")) return { ...b, name: "Equity & Stock Options", icon: "📈" };
      if (b.name.includes("Comprehensive Health")) return { ...b, name: "Premium Medical Coverage" };
      if (b.name.includes("Flexible Work Hours"))
        return { ...b, name: "Generous PTO Policy", category: BenefitCategory.WORK_LIFE_BALANCE, icon: "🏖️" };
      if (b.name.includes("Continuous Learning"))
        return { ...b, name: "Tuition Reimbursement", category: BenefitCategory.CAREER_GROWTH, icon: "🎓" };
      if (b.name.includes("Modern Office"))
        return { ...b, name: "Eco-Friendly Office Design", category: BenefitCategory.WORK_ENVIRONMENT, icon: "🌿" };
      if (b.name.includes("Mental Wellness"))
        return { ...b, name: "Wellness & Fitness Programs", category: BenefitCategory.HEALTH, icon: "🧘" };
      if (b.name.includes("Annual Performance"))
        return { ...b, name: "Profit-Sharing Plan", category: BenefitCategory.FINANCIAL, icon: "🤝" };
      if (b.name.includes("Remote Work"))
        return { ...b, name: "4-Day Work Week Pilot", category: BenefitCategory.WORK_LIFE_BALANCE, icon: "🕓" };
      return b;
    });
  }
  return base;
}

function descriptionFor(name) {
  if (name.includes("GreenLeaf"))
    return "GreenLeaf Solutions pioneers renewable energy and sustainable agriculture solutions, building a greener future through innovation and action.";
  return "TechNova Innovations drives digital transformation with cloud, AI, and analytics solutions for global enterprises. The future is here.";
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
