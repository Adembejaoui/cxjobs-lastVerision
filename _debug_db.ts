import "dotenv/config";
import { PrismaClient } from "./app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const a = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter: a, log: ["error"] });

async function main() {
  const [u, c, j, ca] = await Promise.all([
    p.user.count(),
    p.companies.count(),
    p.jobOffer.count(),
    p.candidate.count(),
  ]);
  console.log("users", u, "companies", c, "jobs", j, "candidates", ca);
  const apps = await p.application.count();
  console.log("applications", apps);

  const cols = await p.$queryRaw<
    Array<{ column_name: string; data_type: string }>
  >`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='candidates' ORDER BY ordinal_position`;
  console.log("candidate columns", JSON.stringify(cols, null, 2));

  const jobCols = await p.$queryRaw<
    Array<{ column_name: string; data_type: string }>
  >`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='job_offers' ORDER BY ordinal_position`;
  console.log("job_offers columns", JSON.stringify(jobCols, null, 2));

  const appCols = await p.$queryRaw<
    Array<{ column_name: string; data_type: string }>
  >`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='applications' ORDER BY ordinal_position`;
  console.log("applications columns", JSON.stringify(appCols, null, 2));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
