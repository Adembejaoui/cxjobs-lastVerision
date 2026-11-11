import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { UserProvider } from "@/components/auth/user-provider";

/**
 * Public pages are the same for every visitor, so this layout does not read
 * the session (launch plan A10): reading cookies here made every public page
 * render per request. The navbar, footer and the job/apply pages read the
 * signed-in user on the client instead (SessionProvider in app/providers.tsx).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <Navbar />
      {children}
      <Footer />
    </UserProvider>
  );
}
