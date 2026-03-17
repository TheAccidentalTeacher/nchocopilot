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
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
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
    <div className="w-full bg-gray-200 rounded-full h-3">
      <div
        className={`h-3 rounded-full transition-all ${pct === 100 ? "bg-green-500" : pct > 50 ? "bg-blue-500" : "bg-amber-500"}`}
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
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
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
        <h1 className="text-2xl font-bold text-gray-900">Store Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">SEO Coverage</h2>
        <ProgressBar done={withSeo} total={totalProducts} />
        <p className="text-sm text-gray-500 mt-2">
          {withSeo} of {totalProducts} products have SEO titles/descriptions
        </p>
      </div>

      {/* Policies Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Policies</h2>
          <span className="text-sm text-gray-500">
            {filledPolicies} / {totalPolicies} filled
          </span>
        </div>
        <div className="space-y-2">
          {data.policies.map((p) => (
            <div
              key={p.type}
              className="flex items-center justify-between py-1"
            >
              <span className="text-sm text-gray-700">{p.type}</span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  p.body?.trim()
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {p.body?.trim() ? "✅ Filled" : "❌ Empty"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            📦 View Products
          </Link>
          <Link
            href="/products?filter=no-seo"
            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors"
          >
            🔍 Fix All SEO ({totalProducts - withSeo} missing)
          </Link>
          {vendorIssues > 0 && (
            <Link
              href="/products?filter=vendor-issues"
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              ⚠️ Fix Vendors ({vendorIssues})
            </Link>
          )}
          <Link
            href="/policies"
            className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            📋 Manage Policies
          </Link>
          <Link
            href="/blog"
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            📝 New Blog Post
          </Link>
        </div>
      </div>

      {/* Collections summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-3">
          Collections ({data.collections.length})
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {data.collections.slice(0, 12).map((c) => (
            <div key={c.id} className="text-sm text-gray-600 py-1">
              {c.title}{" "}
              <span className="text-gray-400">
                ({c.productsCount?.count ?? 0})
              </span>
            </div>
          ))}
          {data.collections.length > 12 && (
            <div className="text-sm text-gray-400">
              +{data.collections.length - 12} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
