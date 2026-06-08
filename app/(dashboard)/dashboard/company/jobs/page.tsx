import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CompanyJobsClient } from "./company-jobs-client";

export default async function CompanyJobsPage() {
  const session = await auth();

  if (!session || session.user.role !== "COMPANY") {
    redirect("/login");
  }

  // Get company
  const company = await prisma.companies.findUnique({
    where: { userId: session.user.id },
  });

  if (!company) {
    if (session.user.isOnboarded) {
      redirect("/dashboard/company");
    }
    redirect("/onboarding/company");
  }

  // Fetch all jobs with applicant counts
  const jobs = await prisma.jobOffer.findMany({
    where: {
      companyId: company.id,
      deletedAt: null,
    },
    include: {
      _count: {
        select: { applications: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate stats
  const activeJobsCount = jobs.filter((j: typeof jobs[number]) => j.status === "PUBLISHED").length;
  const totalApplicants = await prisma.application.count({
    where: {
      jobOffer: { companyId: company.id },
    },
  });

  // Get recent applicants count (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentApplicants = await prisma.application.count({
    where: {
      jobOffer: { companyId: company.id },
      createdAt: { gte: weekAgo },
    },
  });

  const stats = {
    activeJobs: activeJobsCount,
    totalApplicants: totalApplicants,
    totalJobs: jobs.length,
    recentApplicants: recentApplicants,
  };

  return (
    <CompanyJobsClient jobs={jobs} stats={stats} />
  );
}
