import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CVPageClient } from "@/components/cv/cv-page-client";
import type { Prisma } from "@/app/generated/prisma/client";

export default async function CVPage() {
  const session = await auth();

  if (!session || session.user.role !== "CANDIDATE") {
    redirect("/login");
  }

  // Fetch candidate data with all related data
  const candidate = await prisma.candidate.findFirst({
    where: {
      userId: session.user.id,
    },
    include: {
      user: {
        select: {
          email: true,
          image: true,
        },
      },
      experiences: {
        orderBy: { startDate: "desc" },
      },
      education: {
        orderBy: { startDate: "desc" },
      },
      languages: true,
      skills: true,
    },
  }) as Prisma.CandidateGetPayload<{
    include: {
      user: { select: { email: true; image: true } };
      experiences: { orderBy: { startDate: "desc" } };
      education: { orderBy: { startDate: "desc" } };
      languages: true;
      skills: true;
    };
  }> | null;

  if (!candidate) {
    redirect("/onboarding/candidate");
  }

  return <CVPageClient candidate={candidate} />;
}
