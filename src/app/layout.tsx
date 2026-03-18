import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import LayoutShell from "@/components/layout-shell";
import Sidebar from "@/components/sidebar";
import { createServerSupabase } from "@/lib/supabase-auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NCHO Tools",
  description: "Management tools for Next Chapter Homeschool Outpost",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check auth — if not logged in, render children only (login page)
  let userEmail: string | null = null;
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    userEmail = user?.email ?? null;
  } catch {
    // Not authenticated
  }

  // Determine if this is the login page by reading request URL
  const headersList = await headers();
  const url = headersList.get("x-url") || headersList.get("x-invoke-path") || "";
  const isLoginPage = url.includes("/login") || !userEmail;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-pink-50 via-sky-50/40 to-emerald-50/30`}
      >
        {isLoginPage && !userEmail ? (
          // Login page — no sidebar, no shell
          children
        ) : (
          <div className="flex min-h-screen">
            <Sidebar userEmail={userEmail!} />
            <LayoutShell>{children}</LayoutShell>
          </div>
        )}
      </body>
    </html>
  );
}
