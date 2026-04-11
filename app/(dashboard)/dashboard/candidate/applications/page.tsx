import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CandidateApplicationsClient } from "./candidate-applications-client";

export default async function CandidateApplicationsPage() {
  const session = await auth();

  if (!session || session.user.role !== "CANDIDATE") {
    redirect("/login");
  }

  // Get candidate profile
  const candidate = await prisma.candidate.findUnique({
    where: { userId: session.user.id },
  });

  if (!candidate) {
    redirect("/onboarding/candidate");
  }

  // Fetch applications for this candidate
  const applications = await prisma.application.findMany({
    where: { candidateId: candidate.id },
    include: {
      jobOffer: {
        select: {
          id: true,
          title: true,
          slug: true,
          customLocation: true,
          status: true,
          contractType: true,
          isRemote: true,
          isHybrid: true,
          salary: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          createdAt: true,
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
  });

  return <CandidateApplicationsClient applications={applications} />;
}
