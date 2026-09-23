import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "./logger";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const adapter = new PrismaPg(
  {
    connectionString: process.env.DATABASE_URL,
    idleTimeoutMillis: 5000,
    max:5,
    connectionTimeoutMillis: 5000,
  },
  {
    onPoolError: (err: Error) => {
      logger.error("Database pool error", { error: err?.message ?? String(err) });
    },
    onConnectionError: (err: Error) => {
      logger.error("Database connection error", { error: err?.message ?? String(err) });
    },
  }
);

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

export const connectPrisma = async () => {
  if (process.env.NODE_ENV === "production") {
    await prisma.$connect();
  }
};

export default prisma;
