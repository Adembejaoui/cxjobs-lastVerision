import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const prisma = new PrismaClient({ adapter });

async function verify() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      role: true,
      isActive: true,
      isOnboarded: true,
      passwordHash: true,
    },
  });

  for (const user of users) {
    const isBcrypt = user.passwordHash?.startsWith("$2") ?? false;
    let matches = false;
    if (user.passwordHash) {
      matches = await bcrypt.compare("password", user.passwordHash);
    }
    console.log(
      `${user.email} | role=${user.role} | onboarded=${user.isOnboarded} | active=${user.isActive} | bcrypt=${isBcrypt} | password_matches=${matches}`
    );
  }

  await prisma.$disconnect();
}

verify().catch((e) => {
  console.error(e);
  process.exit(1);
});
