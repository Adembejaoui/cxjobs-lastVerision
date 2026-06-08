import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardProfilePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  switch (session.user.role) {
    case "COMPANY":
      redirect("/dashboard/company/profile");
    case "CANDIDATE":
      redirect("/dashboard/candidate/profile");
    default:
      redirect("/dashboard");
  }
}
