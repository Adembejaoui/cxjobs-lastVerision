import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Redirect based on user role
  switch (session.user.role) {
    case "COMPANY":
      redirect("/dashboard/company");
    case "CANDIDATE":
      redirect("/dashboard/candidate");
    case "ADMIN":
      redirect("/admin");
    default:
      redirect("/");
  }
}
