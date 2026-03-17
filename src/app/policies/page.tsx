"use client";

import { useState, useEffect } from "react";
import { POLICIES } from "@/lib/policies-data";
import type { ShopifyPolicy } from "@/lib/types";

export default function PoliciesPage() {
  const [livePolicies, setLivePolicies] = useState<ShopifyPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.policies) setLivePolicies(data.policies);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const policyEntries = Object.entries(POLICIES);

  const isLive = (policyKey: string) => {
    const policy = POLICIES[policyKey];
    return livePolicies.some(
      (lp) =>
        lp.type?.toLowerCase().includes(policyKey) && lp.body?.trim()
    );
  };

  const handlePush = async (key: string) => {
    setPushing(key);
    setStatusMsg((prev) => ({ ...prev, [key]: "" }));

    // Note: Pushing policies requires write_content scope
    // This shows what WILL happen once scopes are enabled
    setStatusMsg((prev) => ({
      ...prev,
      [key]:
        "⚠️ Write scopes not yet enabled. Copy the text below and paste into Shopify admin manually, or wait until write_content scope is added.",
    }));
    setPushing(null);
  };

  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste-ready policies for your Shopify store. Review each one, then
          push to Shopify or copy to clipboard.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-4 text-sm">
        <strong>Note:</strong> Write scopes are not yet enabled on the Shopify
        app. For now, expand each policy, copy the content, and paste it into
        your Shopify admin pages. Once write_content scope is added, the
        &quot;Push to Shopify&quot; button will work automatically.
      </div>

      <div className="space-y-4">
        {policyEntries.map(([key, policy]) => {
          const live = isLive(key);
          const isExpanded = expanded === key;

          return (
            <div
              key={key}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      live
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {live ? "✅ Live" : "❌ Not set"}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {policy.title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Shopify page title: {policy.pageTitle}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setExpanded(isExpanded ? null : key)
                    }
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {isExpanded ? "Collapse" : "Preview"}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(policy.body);
                      setStatusMsg((prev) => ({
                        ...prev,
                        [key]: "📋 Copied to clipboard!",
                      }));
                      setTimeout(
                        () =>
                          setStatusMsg((prev) => ({
                            ...prev,
                            [key]: "",
                          })),
                        3000
                      );
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => handlePush(key)}
                    disabled={pushing === key}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {pushing === key ? "Pushing..." : "Push to Shopify"}
                  </button>
                </div>
              </div>

              {statusMsg[key] && (
                <div className="px-4 pb-2">
                  <p
                    className={`text-sm ${statusMsg[key].startsWith("⚠️") ? "text-amber-600" : "text-green-600"}`}
                  >
                    {statusMsg[key]}
                  </p>
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: policy.body }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
