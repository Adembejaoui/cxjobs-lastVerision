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

  const [company, jobOffer] = await Promise.all([
    prisma.companies.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
    prisma.jobOffer.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        title: true,
        customLocation: true,
        companyId: true,
        deletedAt: true,
      },
    }),
  ]);

  if (!company || !jobOffer || jobOffer.deletedAt) {
    redirect("/dashboard/company/jobs");
  }

  if (jobOffer.companyId !== company.id) {
    redirect("/dashboard/company/jobs");
  }

  const PAGE_SIZE = 25;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [total, recentApplications, statusCounts, firstPage] = await Promise.all([
    prisma.application.count({ where: { jobOfferId: jobId } }),
    prisma.application.count({
      where: { jobOfferId: jobId, createdAt: { gte: weekAgo } },
    }),
    prisma.application.groupBy({
      by: ["status"],
      where: { jobOfferId: jobId },
      _count: true,
    }),
prisma.application.findMany({
       where: { jobOfferId: jobId },
       take: PAGE_SIZE,
       orderBy: { createdAt: "desc" },
       include: {
         candidate: {
           select: {
             id: true,
             firstName: true,
             lastName: true,
             avatarUrl: true,
             resumeUrl: true,
             user: {
               select: {
                 id: true,
                 name: true,
                 email: true,
                 image: true,
               },
             },
           },
         },
       },
     }),
  ]);

  const byStatus = (status: string) =>
    statusCounts.find((s: { status: string; _count: number }) => s.status === status)?._count ?? 0;

  const stats = {
    total,
    new: byStatus("NOUVEAU"),
    inReview: byStatus("EN_COURS_EXAMEN"),
    interview: byStatus("ENTRETIEN"),
    hired: byStatus("EMBAUCHES"),
    rejected: byStatus("REFUSE"),
    recent: recentApplications,
  };

  return (
    <JobApplicationsClient
      jobOffer={jobOffer}
      applications={firstPage}
      stats={stats}
      initialTotal={total}
      initialPage={1}
      pageSize={PAGE_SIZE}
    />
  );
}
