"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/changes", label: "Change Log", icon: "🔄" },
  { href: "/blog", label: "Blog", icon: "📝" },
  { href: "/policies", label: "Policies", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const displayName = userEmail.split("@")[0]; // "scott" or "anna"

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <aside className="w-56 bg-gradient-to-b from-white to-pink-50/60 border-r border-pink-100 flex flex-col shrink-0">
      <div className="p-4 border-b border-pink-100">
        <h1 className="font-bold text-lg text-pink-700">NCHO Tools</h1>
        <p className="text-xs text-pink-400">Store Management</p>
      </div>
      <nav className="flex-1 p-2">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === item.href
                ? "bg-pink-100/80 text-pink-700 font-medium"
                : "text-pink-800/70 hover:bg-pink-100/60 hover:text-pink-700"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-pink-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-pink-600 font-medium capitalize">
            {displayName}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-pink-400 hover:text-pink-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
