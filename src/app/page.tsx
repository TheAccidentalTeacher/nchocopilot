"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/shopify-queries";

function StatCard({
  label,
  value,
  sub,
  color = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "blue" | "green" | "red" | "amber" | "gray";
}) {
  const colors = {
    blue: "bg-sky-50 border-sky-200 text-sky-700",
    green: "bg-emerald-50 border-emerald-200 text-emerald-700",
    red: "bg-pink-50 border-pink-200 text-pink-600",
    amber: "bg-amber-50 border-amber-200 text-amber-600",
    gray: "bg-sky-50/50 border-sky-100 text-sky-600",
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="w-full bg-pink-100 rounded-full h-3">
      <div
        className={`h-3 rounded-full transition-all ${pct === 100 ? "bg-emerald-400" : pct > 50 ? "bg-sky-400" : "bg-amber-400"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-pink-100 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-pink-100/60 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-pink-50 border border-pink-200 text-pink-700 rounded-lg p-4">
        <h2 className="font-bold">Connection Error</h2>
        <p className="text-sm mt-1">{error}</p>
        <p className="text-xs mt-2">Check your .env.local credentials and try again.</p>
      </div>
    );
  }

  if (!data) return null;

  const totalProducts = data.products.length;
  const withSeo = data.products.filter(
    (p) => p.seo?.title || p.seo?.description
  ).length;
  const vendorIssues = data.products.filter(
    (p) => p.vendor === "Author Name"
  ).length;
  const totalArticles = data.blogs.reduce(
    (sum, b) => sum + b.articles.length,
    0
  );
  const filledPolicies = data.policies.filter((p) => p.body?.trim()).length;
  const totalPolicies = data.policies.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-pink-900">Store Dashboard</h1>
        <p className="text-sm text-pink-400 mt-1">
          {data.shop.name} — {data.shop.primaryDomain?.host || data.shop.myshopifyDomain}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Products" value={totalProducts} color="blue" />
        <StatCard
          label="SEO Complete"
          value={`${withSeo} / ${totalProducts}`}
          sub={`${totalProducts > 0 ? Math.round((withSeo / totalProducts) * 100) : 0}%`}
          color={withSeo === totalProducts ? "green" : "amber"}
        />
        <StatCard
          label="Vendor Issues"
          value={vendorIssues}
          sub={vendorIssues > 0 ? '"Author Name" placeholder' : "All clean"}
          color={vendorIssues > 0 ? "red" : "green"}
        />
        <StatCard
          label="Blog Articles"
          value={totalArticles}
          sub={totalArticles === 0 ? "None published yet" : undefined}
          color={totalArticles > 0 ? "green" : "gray"}
        />
      </div>

      {/* SEO Progress */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-6 shadow-sm">
        <h2 className="font-semibold text-pink-800 mb-3">SEO Coverage</h2>
        <ProgressBar done={withSeo} total={totalProducts} />
        <p className="text-sm text-sky-500 mt-2">
          {withSeo} of {totalProducts} products have SEO titles/descriptions
        </p>
      </div>

      {/* Policies Status */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-pink-800">Policies</h2>
          <span className="text-sm text-pink-400">
            {filledPolicies} / {totalPolicies} filled
          </span>
        </div>
        <div className="space-y-2">
          {data.policies.map((p) => (
            <div
              key={p.type}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm text-pink-800/80">{p.type}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  p.body?.trim()
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-pink-100 text-pink-600"
                }`}
              >
                {p.body?.trim() ? "✅ Filled" : "❌ Empty"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-6 shadow-sm">
        <h2 className="font-semibold text-pink-800 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products"
            className="px-4 py-2 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 transition-colors shadow-sm"
          >
            📦 View Products
          </Link>
          <Link
            href="/products?filter=no-seo"
            className="px-4 py-2 bg-amber-400 text-amber-900 text-sm rounded-lg hover:bg-amber-500 transition-colors shadow-sm"
          >
            🔍 Fix All SEO ({totalProducts - withSeo} missing)
          </Link>
          {vendorIssues > 0 && (
            <Link
              href="/products?filter=vendor-issues"
              className="px-4 py-2 bg-pink-400 text-white text-sm rounded-lg hover:bg-pink-500 transition-colors shadow-sm"
            >
              ⚠️ Fix Vendors ({vendorIssues})
            </Link>
          )}
          <Link
            href="/policies"
            className="px-4 py-2 bg-sky-400 text-white text-sm rounded-lg hover:bg-sky-500 transition-colors shadow-sm"
          >
            📋 Manage Policies
          </Link>
          <Link
            href="/blog"
            className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
          >
            📝 New Blog Post
          </Link>
        </div>
      </div>

      {/* Collections summary */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-6 shadow-sm">
        <h2 className="font-semibold text-pink-800 mb-3">
          Collections ({data.collections.length})
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {data.collections.slice(0, 12).map((c) => (
            <div key={c.id} className="text-sm text-sky-700 py-1">
              {c.title}{" "}
              <span className="text-sky-400">
                ({c.productsCount?.count ?? 0})
              </span>
            </div>
          ))}
          {data.collections.length > 12 && (
            <div className="text-sm text-pink-300">
              +{data.collections.length - 12} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
