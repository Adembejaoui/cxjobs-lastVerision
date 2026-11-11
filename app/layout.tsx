import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { assertEnv } from "@/lib/env";
import { siteUrl } from "@/lib/seo/site-url";
import "./globals.css";

assertEnv();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves relative canonical / Open Graph URLs (U3). Configuration only.
  metadataBase: new URL(siteUrl()),
  title: "CXJobs - Find Your Dream Job",
  description: "Find the best jobs and career opportunities in the customer experience industry",
  openGraph: {
    type: "website",
    siteName: "CXJobs",
    title: "CXJobs - Find Your Dream Job",
    description: "Find the best jobs and career opportunities in the customer experience industry",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}