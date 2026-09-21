import "dotenv/config";
import { PrismaClient } from "./app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const a = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter: a, log: ["error"] });

async function main() {
  // Try camelCase quoted (matches migration) vs snake_case unquoted
  try {
    const r1 = await p.$queryRaw<{ cnt: number }[]>`SELECT COUNT(*)::int AS cnt FROM applications a JOIN job_offers j ON a."jobOfferId" = j.id WHERE j."companyId" = '00000000-0000-0000-0000-000000000000'`;
    console.log("camelCase quoted OK:", JSON.stringify(r1));
  } catch (e) {
    console.log("camelCase quoted ERROR:", e instanceof Error ? e.message : String(e));
  }

  try {
    const r2 = await p.$queryRaw<{ cnt: number }[]>`SELECT COUNT(*)::int AS cnt FROM applications a JOIN job_offers j ON a.job_offer_id = j.id WHERE j.company_id = '00000000-0000-0000-0000-000000000000'`;
    console.log("snake_case unquoted OK:", JSON.stringify(r2));
  } catch (e) {
    console.log("snake_case unquoted ERROR:", e instanceof Error ? e.message : String(e));
  }

  // Show a real company id + counts
  const co = await p.companies.findFirst({ select: { id: true, name: true, slug: true } });
  console.log("sample company:", co);
  if (co) {
    const counts = await p.$transaction([
      p.application.count({ where: { jobOffer: { companyId: co.id } } }),
      p.jobOffer.count({ where: { companyId: co.id, deletedAt: null } }),
      p.candidate.count(),
    ]);
    console.log("counts [apps, jobs, candidates]:", counts);
  }
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
