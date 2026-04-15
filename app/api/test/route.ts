import  prisma  from "@/lib/prisma";

await prisma.user.findMany({
  where: {
    email: {
      contains: "alice@prisma.io",
    },
  },
  cacheStrategy: { ttl: 60 },
});