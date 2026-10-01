import prisma from "@/lib/prisma";

async function main() {
  try {
    const r = await prisma.$queryRawUnsafe("SELECT 1 as ok");
    console.log("DB_OK", JSON.stringify(r));
  } catch (e) {
    console.log("DB_FAIL", (e as Error).message.split("\n")[0]);
  } finally {
    await prisma.$disconnect();
  }
}

void main();