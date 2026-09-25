import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CandidateApplicationsClient } from "./candidate-applications-client";

export default async function CandidateApplicationsPage() {
  const session = await auth();

  if (!session || session.user.role !== "CANDIDATE") {
    redirect("/login");
  }

  const candidate = await prisma.candidate.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!candidate) {
    redirect("/onboarding/candidate");
  }

  const PAGE_SIZE = 25;
  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where: { candidateId: candidate.id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        jobOffer: {
          select: {
            id: true,
            title: true,
            slug: true,
            customLocation: true,
            isRemote: true,
            isHybrid: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                location: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.application.count({ where: { candidateId: candidate.id } }),
  ]);

  return <CandidateApplicationsClient applications={applications} initialTotal={total} initialPage={1} pageSize={PAGE_SIZE} />;
}
