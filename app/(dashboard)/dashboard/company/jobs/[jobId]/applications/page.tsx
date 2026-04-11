import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { JobApplicationsClient } from "./job-applications-client";

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function JobApplicationsPage({ params }: PageProps) {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  const { jobId } = await params;

  // Get company
  const company = await prisma.company.findUnique({
    where: { userId: session.user.id },
  });

  if (!company) {
    redirect("/onboarding/company");
  }

  // Get job offer and verify ownership
  const jobOffer = await prisma.jobOffer.findUnique({
    where: { id: jobId },
    include: {
      company: true,
    },
  });

  if (!jobOffer || jobOffer.deletedAt) {
    redirect("/dashboard/company/jobs");
  }

  // Verify company owns this job
  if (jobOffer.companyId !== company.id) {
    redirect("/dashboard/company/jobs");
  }

  // Fetch applications for this job with detailed candidate data
  const [applications, total] = await Promise.all([
    prisma.application.findMany({
      where: { jobOfferId: jobId },
      include: {
        candidate: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            skills: true,
            languages: true,
            experiences: {
              orderBy: { startDate: "desc" },
            },
            education: {
              orderBy: { startDate: "desc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.application.count({
      where: { jobOfferId: jobId },
    }),
  ]);

  // Get recent applications (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentApplications = await prisma.application.count({
    where: {
      jobOfferId: jobId,
      createdAt: { gte: weekAgo },
    },
  });

  // Calculate stats by status
  const statusCounts = {
    NOUVEAU: applications.filter((a: typeof applications[number]) => a.status === "NOUVEAU").length,
    EN_COURS_EXAMEN: applications.filter((a: typeof applications[number]) => a.status === "EN_COURS_EXAMEN").length,
    ENTRETIEN: applications.filter((a: typeof applications[number]) => a.status === "ENTRETIEN").length,
    EMBAUCHES: applications.filter((a: typeof applications[number]) => a.status === "EMBAUCHES").length,
    REFUSE: applications.filter((a: typeof applications[number]) => a.status === "REFUSE").length,
  };

  const stats = {
    total: total,
    new: statusCounts.NOUVEAU,
    inReview: statusCounts.EN_COURS_EXAMEN,
    interview: statusCounts.ENTRETIEN,
    hired: statusCounts.EMBAUCHES,
    rejected: statusCounts.REFUSE,
    recent: recentApplications,
  };

  return (
    <JobApplicationsClient
      jobOffer={jobOffer}
      applications={applications}
      stats={stats}
    />
  );
}
