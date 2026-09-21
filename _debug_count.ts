import "dotenv/config";
import { PrismaClient } from "./app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function main() {
  const now = new Date();
  console.log("now:", now.toISOString());

  const total = await prisma.jobOffer.count();
  console.log("total job_offers:", total);

  const byStatus = await prisma.jobOffer.groupBy({
    by: ["status"],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  console.log("byStatus (deletedAt null):", JSON.stringify(byStatus));

  const published = await prisma.jobOffer.count({
    where: { deletedAt: null, status: "PUBLISHED" },
  });
  console.log("published non-deleted:", published);

  const publishedAndNotExpired = await prisma.jobOffer.count({
    where: { deletedAt: null, status: "PUBLISHED", expiresAt: { gt: now } },
  });
  console.log("published + expiresAt>now:", publishedAndNotExpired);

  const publishedNullExpiry = await prisma.jobOffer.count({
    where: { deletedAt: null, status: "PUBLISHED", expiresAt: null },
  });
  console.log("published + expiresAt is NULL:", publishedNullExpiry);

  const publishedNullAndFuture = await prisma.jobOffer.count({
    where: {
      deletedAt: null,
      status: "PUBLISHED",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
  console.log("published + (null OR future):", publishedNullAndFuture);

  const sample = await prisma.jobOffer.findMany({
    where: { deletedAt: null, status: "PUBLISHED" },
    select: { title: true, status: true, expiresAt: true, deletedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("sample published:", JSON.stringify(sample, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
