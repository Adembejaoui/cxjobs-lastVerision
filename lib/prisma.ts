import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "./logger";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

/**
 * Explicit PostgreSQL pool.
 *
 * This is the recommended pattern for Prisma driver adapters
 * with Vercel Fluid Compute:
 *
 * Pool -> attachDatabasePool() -> PrismaPg -> PrismaClient
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 2000,
  max: 2,
  connectionTimeoutMillis: 5000,
});

/**
 * Let Vercel Fluid Compute manage idle database connections
 * when a function instance is suspended.
 */
attachDatabasePool(pool);

/**
 * Preserve database pool error logging.
 *
 * With an explicit pg.Pool, pool-level errors are handled here
 * instead of PrismaPg's internal onPoolError callback.
 */
pool.on("error", (err: Error) => {
  logger.error("Database pool error", {
    error: err?.message ?? String(err),
  });
});

/**
 * Prisma adapter uses the explicit pg pool above.
 */
const adapter = new PrismaPg(pool);

/**
 * Keep the existing global Prisma singleton.
 */
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "production"
        ? ["error"]
        : ["query", "error", "warn"],
  });

globalForPrisma.prisma = prisma;

/**
 * Kept for backwards compatibility.
 *
 * This function is currently unused in the application.
 * Do not call it per request.
 */
export const connectPrisma = async () => {
  if (process.env.NODE_ENV === "production") {
    await prisma.$connect();
  }
};

export default prisma;