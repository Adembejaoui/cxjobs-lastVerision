import "dotenv/config";
import prisma from "./lib/prisma";

async function test() {
  try {
    const result = await prisma.user.findFirst({ where: { id: "test" } });
    console.log("Success:", result);
  } catch (err) {
    console.log("Error:", err);
    /*console.log("Error message:", err?.message);
    console.log("Error code:", err?.code);
    console.log("Error meta:", err?.meta);*/
  }
  await prisma.$disconnect();
}

test();