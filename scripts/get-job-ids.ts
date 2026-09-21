import "dotenv/config";
import { Client } from "pg";

const connStr = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL  || "";
console.log("Using connection string (masked):", connStr.replace(/:[^:]+@/, ":****@"));

const client = new Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {
  await client.connect();
  console.log("Connected to database!\n");

  const totalResult = await client.query(
    'SELECT COUNT(*)::int AS cnt FROM job_offers WHERE "deletedAt" IS NULL'
  );
  console.log("Total job_offers (non-deleted):", totalResult.rows[0].cnt);

  const publishedResult = await client.query(`
    SELECT COUNT(*)::int AS cnt FROM job_offers
    WHERE "deletedAt" IS NULL
      AND status = 'PUBLISHED'
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
  `);
  console.log("Published + not expired + not deleted:", publishedResult.rows[0].cnt);

  const jobsResult = await client.query(`
    SELECT id, title, slug, status, "createdAt",
      (SELECT COUNT(*) FROM job_offer_benefits WHERE "jobOfferId" = job_offers.id) AS benefit_count,
      (SELECT COUNT(*) FROM job_languages WHERE "jobOfferId" = job_offers.id) AS language_count,
      (SELECT COUNT(*) FROM applications WHERE "jobOfferId" = job_offers.id) AS application_count
    FROM job_offers
    WHERE "deletedAt" IS NULL
      AND status = 'PUBLISHED'
      AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    ORDER BY "createdAt" DESC
    LIMIT 60
  `);

  console.log("\n--- Publishing 60 real published job IDs for k6 test embedding ---");
  const ids: string[] = [];
  for (const row of jobsResult.rows) {
    ids.push(row.id);
  }
  console.log(JSON.stringify(ids, null, 2));

  console.log("\n--- Published non-expired jobs (up to 20) ---");
  for (const row of jobsResult.rows) {
    console.log(JSON.stringify({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      created_at: row.created_at,
      benefits: Number(row.benefit_count),
      languages: Number(row.language_count),
      applications: Number(row.application_count),
    }));
  }

  if (jobsResult.rows.length > 0) {
    const sampleId = jobsResult.rows[0].id;
    console.log("\n--- Full detail for job", sampleId, "---");
    const fullResult = await client.query(`
      SELECT jo.*, c.name AS company_name, c.slug AS company_slug, c.logo_url,
        (SELECT COUNT(*) FROM job_offer_benefits WHERE "jobOfferId" = jo.id) AS benefit_count,
        (SELECT COUNT(*) FROM job_languages WHERE "jobOfferId" = jo.id) AS language_count,
        (SELECT COUNT(*) FROM applications WHERE "jobOfferId" = jo.id) AS application_count
      FROM job_offers jo
      LEFT JOIN companies c ON jo."companyId" = c.id
      WHERE jo.id = $1
    `, [sampleId]);
    console.log(JSON.stringify(fullResult.rows[0], null, 2));

    const benefitResult = await client.query(`
      SELECT b.*, jobb."customDescription"
      FROM job_offer_benefits jobb
      JOIN company_benefits b ON jobb."benefitId" = b.id
      WHERE jobb."jobOfferId" = $1
    `, [sampleId]);
    console.log("\nBenefits:", benefitResult.rows.length, JSON.stringify(benefitResult.rows, null, 2));

    const langResult = await client.query(
      'SELECT * FROM job_languages WHERE "jobOfferId" = $1',
      [sampleId]
    );
    console.log("\nLanguages:", langResult.rows.length, JSON.stringify(langResult.rows, null, 2));
  }

  await client.end();
  console.log("\nDone!");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
