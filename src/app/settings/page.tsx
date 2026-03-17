"use client";

import { useEffect, useState } from "react";

interface ConnectionStatus {
  connected: boolean;
  store: string | null;
  tokenValid: boolean;
  error: string | null;
  scopes: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/connection-status");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setStatus(data);
      setLastSync(new Date().toLocaleString());
    } catch {
      setStatus({
        connected: false,
        store: null,
        tokenValid: false,
        error: "Failed to check connection",
        scopes: null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleRefreshData = async () => {
    setRefreshing(true);
    try {
      // Force a fresh fetch by calling dashboard API (which will re-cache)
      await fetch("/api/dashboard");
      setLastSync(new Date().toLocaleString());
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-pink-900">Settings</h1>
        <p className="text-sm text-pink-400 mt-1">
          Shopify connection and app configuration
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-6 shadow-sm">
        <h2 className="font-semibold text-pink-800 mb-4">
          Shopify Connection
        </h2>

        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-pink-100 rounded w-64" />
            <div className="h-4 bg-pink-100 rounded w-48" />
          </div>
        ) : status ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full ${
                  status.connected ? "bg-emerald-400" : "bg-pink-500"
                }`}
              />
              <span className="text-sm text-pink-800">
                {status.connected
                  ? "Connected to Shopify"
                  : "Not connected"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-pink-400">Store</p>
                <p className="font-medium text-pink-900">
                  {status.store || "Not configured"}
                </p>
              </div>
              <div>
                <p className="text-pink-400">Token</p>
                <p className="font-medium text-pink-900">
                  {status.tokenValid ? "✅ Valid" : "❌ Invalid"}
                </p>
              </div>
              <div>
                <p className="text-pink-400">Scopes</p>
                <p className="font-medium text-pink-900">
                  {status.scopes || "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-pink-400">Last Sync</p>
                <p className="font-medium text-pink-900">
                  {lastSync || "Never"}
                </p>
              </div>
            </div>

            {status.error && (
              <div className="bg-pink-50 border border-pink-200 text-pink-700 rounded-lg p-3 text-sm">
                {status.error}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-4 flex gap-3">
          <button
            onClick={checkConnection}
            disabled={loading}
            className="px-4 py-2 text-sm border border-pink-200 rounded-lg hover:bg-pink-50 disabled:opacity-50 transition-colors"
          >
            🔄 Re-check Connection
          </button>
          <button
            onClick={handleRefreshData}
            disabled={refreshing}
            className="px-4 py-2 text-sm bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            {refreshing ? "Refreshing..." : "🔄 Refresh Store Data"}
          </button>
        </div>
      </div>

      {/* API Configuration (display-only) */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-6 shadow-sm">
        <h2 className="font-semibold text-pink-800 mb-4">
          API Configuration
        </h2>
        <p className="text-sm text-pink-400 mb-4">
          These values are loaded from environment variables (.env.local). They
          cannot be changed here.
        </p>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between py-2 border-b border-pink-50">
            <span className="text-pink-400">SHOPIFY_STORE</span>
            <code className="text-pink-900 bg-pink-50 px-2 py-0.5 rounded text-xs">
              {status?.store || "***"}
            </code>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-pink-50">
            <span className="text-pink-400">SHOPIFY_CLIENT_ID</span>
            <code className="text-pink-900 bg-pink-50 px-2 py-0.5 rounded text-xs">
              ••••••••••••4047
            </code>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-pink-50">
            <span className="text-pink-400">SHOPIFY_CLIENT_SECRET</span>
            <code className="text-pink-900 bg-pink-50 px-2 py-0.5 rounded text-xs">
              ••••••••••••d597
            </code>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-pink-50">
            <span className="text-pink-400">SHOPIFY_API_VERSION</span>
            <code className="text-pink-900 bg-pink-50 px-2 py-0.5 rounded text-xs">
              2026-01
            </code>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-pink-400">ANTHROPIC_API_KEY</span>
            <code className="text-pink-900 bg-pink-50 px-2 py-0.5 rounded text-xs">
              {process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ? "••••••••••••" : "Not set"}
            </code>
          </div>
        </div>
      </div>

      {/* Write Scopes Info */}
      <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-6">
        <h2 className="font-semibold mb-2">
          ⚠️ Write Scopes Not Yet Enabled
        </h2>
        <p className="text-sm mb-3">
          The Shopify app currently has read-only access. To enable writing
          (updating SEO, publishing blog posts, pushing policies), Scott needs
          to:
        </p>
        <ol className="text-sm list-decimal list-inside space-y-1">
          <li>
            Go to partners.shopify.com → Apps → Yellow CoPilot → Configuration
          </li>
          <li>
            Add scopes: <code>write_products</code>,{" "}
            <code>write_content</code>, <code>write_online_store</code>
          </li>
          <li>Save → Reinstall app on store (Shopify prompts for re-approval)</li>
          <li>Same credentials — the token just gets new permissions</li>
        </ol>
      </div>
    </div>
  );
}
