"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { ShopifyProduct } from "@/lib/types";

function SeoModal({
  product,
  onClose,
}: {
  product: ShopifyProduct;
  onClose: () => void;
}) {
  const [seoTitle, setSeoTitle] = useState(product.seo?.title || "");
  const [seoDescription, setSeoDescription] = useState(
    product.seo?.description || ""
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const generateSeo = async () => {
    setGenerating(true);
    setStatus(null);
    try {
      const resp = await fetch("/api/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: product.title,
          descriptionHtml: product.descriptionHtml,
          vendor: product.vendor,
          tags: product.tags,
          price: product.priceRangeV2?.minVariantPrice?.amount || "0",
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setSeoTitle(data.seoTitle || "");
      setSeoDescription(data.seoDescription || "");
      setStatus("Generated! Review and approve below.");
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveSeo = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const resp = await fetch("/api/update-product-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          seoTitle,
          seoDescription,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      setStatus("✅ Saved to Shopify!");
    } catch (e) {
      setStatus(
        `Error saving: ${e instanceof Error ? e.message : "Unknown"}. Write scopes may not be enabled yet.`
      );
    } finally {
      setSaving(false);
    }
  };

  const image = product.images?.edges?.[0]?.node;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-start gap-4">
          {image && (
            <img
              src={image.url}
              alt={image.altText || product.title}
              className="w-16 h-16 object-cover rounded"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-gray-900 truncate">
              {product.title}
            </h2>
            <p className="text-sm text-gray-500">
              {product.vendor} · ${product.priceRangeV2?.minVariantPrice?.amount}
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {product.tags?.slice(0, 5).map((t) => (
                <span
                  key={t}
                  className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SEO Title{" "}
              <span className="text-gray-400">
                ({seoTitle.length}/60 chars)
              </span>
            </label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              maxLength={60}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter SEO title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description{" "}
              <span className="text-gray-400">
                ({seoDescription.length}/155 chars)
              </span>
            </label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              maxLength={155}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter meta description..."
            />
          </div>

          {/* Google Preview */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-2">Google Preview</p>
            <p className="text-blue-700 text-base font-medium truncate">
              {seoTitle || product.title}
            </p>
            <p className="text-green-700 text-xs">
              nextchapterhomeschool.com/products/{product.handle}
            </p>
            <p className="text-gray-600 text-sm mt-0.5 line-clamp-2">
              {seoDescription || "No description set."}
            </p>
          </div>

          {status && (
            <p
              className={`text-sm ${status.startsWith("Error") ? "text-red-600" : "text-green-600"}`}
            >
              {status}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={generateSeo}
              disabled={generating}
              className="flex-1 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {generating ? "Generating..." : "🤖 Generate with AI"}
            </button>
            <button
              onClick={saveSeo}
              disabled={saving || (!seoTitle && !seoDescription)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "💾 Save to Shopify"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Filter = "all" | "no-seo" | "has-seo" | "vendor-issues";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(
    (searchParams.get("filter") as Filter) || "all"
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ShopifyProduct | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    fetch("/api/products")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = products;

    if (filter === "no-seo") {
      result = result.filter((p) => !p.seo?.title && !p.seo?.description);
    } else if (filter === "has-seo") {
      result = result.filter((p) => p.seo?.title || p.seo?.description);
    } else if (filter === "vendor-issues") {
      result = result.filter((p) => p.vendor === "Author Name");
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.vendor.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [products, filter, search]);

  const noSeoCount = products.filter(
    (p) => !p.seo?.title && !p.seo?.description
  ).length;

  const handleBulkGenerate = async () => {
    const missing = products.filter(
      (p) => !p.seo?.title && !p.seo?.description
    );
    if (missing.length === 0) return;

    setBulkGenerating(true);
    setBulkProgress({ done: 0, total: missing.length });

    for (let i = 0; i < missing.length; i++) {
      const p = missing[i];
      try {
        const resp = await fetch("/api/generate-seo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: p.title,
            descriptionHtml: p.descriptionHtml,
            vendor: p.vendor,
            tags: p.tags,
            price: p.priceRangeV2?.minVariantPrice?.amount || "0",
          }),
        });
        if (resp.ok) {
          const seo = await resp.json();
          // Try to save to Shopify
          await fetch("/api/update-product-seo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: p.id,
              seoTitle: seo.seoTitle,
              seoDescription: seo.seoDescription,
            }),
          });
          // Update local state
          setProducts((prev) =>
            prev.map((prod) =>
              prod.id === p.id
                ? {
                    ...prod,
                    seo: {
                      title: seo.seoTitle,
                      description: seo.seoDescription,
                    },
                  }
                : prod
            )
          );
        }
      } catch {
        // Continue with next product on error
      }
      setBulkProgress({ done: i + 1, total: missing.length });
      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 1000));
    }

    setBulkGenerating(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
        <h2 className="font-bold">Error loading products</h2>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">
            {products.length} total · {noSeoCount} missing SEO
          </p>
        </div>
        <button
          onClick={handleBulkGenerate}
          disabled={bulkGenerating || noSeoCount === 0}
          className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {bulkGenerating
            ? `Generating ${bulkProgress.done}/${bulkProgress.total}...`
            : `🤖 Bulk Generate SEO (${noSeoCount})`}
        </button>
      </div>

      {/* Bulk progress bar */}
      {bulkGenerating && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex justify-between text-sm text-purple-700 mb-2">
            <span>Generating SEO for all products...</span>
            <span>
              {bulkProgress.done} / {bulkProgress.total}
            </span>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{
                width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All ({products.length})</option>
          <option value="no-seo">Missing SEO ({noSeoCount})</option>
          <option value="has-seo">
            Has SEO ({products.length - noSeoCount})
          </option>
          <option value="vendor-issues">
            Vendor Issues (
            {products.filter((p) => p.vendor === "Author Name").length})
          </option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Product
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Vendor
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Tags
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                SEO Title
              </th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">
                SEO Desc
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => {
              const image = p.images?.edges?.[0]?.node;
              return (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {image ? (
                        <img
                          src={image.url}
                          alt={image.altText || p.title}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                          No img
                        </div>
                      )}
                      <span className="font-medium text-gray-900 truncate max-w-xs">
                        {p.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.vendor === "Author Name"
                          ? "text-red-600 font-medium"
                          : "text-gray-600"
                      }
                    >
                      {p.vendor}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.tags?.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                      {p.tags?.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{p.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.seo?.title ? (
                      <span className="text-green-600">✅</span>
                    ) : (
                      <span className="text-red-400">❌</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.seo?.description ? (
                      <span className="text-green-600">✅</span>
                    ) : (
                      <span className="text-red-400">❌</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ${p.priceRangeV2?.minVariantPrice?.amount || "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No products match your current filter.
          </div>
        )}
      </div>

      {/* SEO Modal */}
      {selected && (
        <SeoModal product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
