import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { UserProvider } from "@/components/auth/user-provider";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user ? {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    image: session.user.image ?? null,
    role: session.user.role,
    isOnboarded: session.user.isOnboarded,
  } : null;

  return (
    <UserProvider user={user}>
      <Navbar user={user} />
      {children}
      <Footer />
    </UserProvider>
  );
}
