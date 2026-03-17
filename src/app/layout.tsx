import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/blog", label: "Blog", icon: "📝" },
  { href: "/policies", label: "Policies", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h1 className="font-bold text-lg text-gray-900">NCHO Tools</h1>
              <p className="text-xs text-gray-500">Store Management</p>
            </div>
            <nav className="flex-1 p-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
              Private tool — Scott & Anna only
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 p-8 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
