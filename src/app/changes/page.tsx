"use client";

import { useEffect, useState, useCallback } from "react";

interface ChangeEntry {
  id: string;
  product_id: string;
  product_title: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  action: string;
  source: string;
  confidence: number | null;
  created_at: string;
}

interface ConflictInfo {
  conflict: true;
  changeId: string;
  field: string;
  product: string;
  expectedValue: string | null;
  currentValue: string | null;
  restoreValue: string;
  message: string;
}

const FIELD_LABELS: Record<string, string> = {
  tags: "Tags",
  seo_title: "SEO Title",
  seo_description: "SEO Description",
  description: "Description",
  title: "Title",
  vendor: "Vendor",
  productType: "Product Type",
  category: "Category",
  metafield: "Metafield",
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  add_tag: { label: "Added tags", color: "bg-green-100 text-green-700" },
  remove_tag: { label: "Removed tags", color: "bg-red-100 text-red-700" },
  set_seo: { label: "Set SEO", color: "bg-blue-100 text-blue-700" },
  update_seo: { label: "Updated SEO", color: "bg-blue-100 text-blue-700" },
  set_seo_title: { label: "Set SEO title", color: "bg-blue-100 text-blue-700" },
  set_seo_description: { label: "Set SEO desc", color: "bg-blue-100 text-blue-700" },
  update_title: { label: "Updated title", color: "bg-purple-100 text-purple-700" },
  update_description: { label: "Updated desc", color: "bg-purple-100 text-purple-700" },
  set_description: { label: "Set description", color: "bg-purple-100 text-purple-700" },
  update_vendor: { label: "Updated vendor", color: "bg-amber-100 text-amber-700" },
  set_vendor: { label: "Set vendor", color: "bg-amber-100 text-amber-700" },
  set_product_type: { label: "Set type", color: "bg-amber-100 text-amber-700" },
  update_productType: { label: "Updated type", color: "bg-amber-100 text-amber-700" },
  classify: { label: "Classified", color: "bg-teal-100 text-teal-700" },
  set_category: { label: "Set category", color: "bg-teal-100 text-teal-700" },
  create_collection: { label: "Created collection", color: "bg-indigo-100 text-indigo-700" },
  create_metafield_definition: { label: "Created metafield def", color: "bg-indigo-100 text-indigo-700" },
  publish_blog: { label: "Published blog", color: "bg-indigo-100 text-indigo-700" },
  set_metafield: { label: "Set metafield", color: "bg-cyan-100 text-cyan-700" },
  undo: { label: "Undo", color: "bg-gray-100 text-gray-600" },
};

const NON_REVERSIBLE = new Set([
  "create_collection", "create_metafield_definition", "publish_blog", "undo",
]);

function isReversible(entry: ChangeEntry): boolean {
  if (NON_REVERSIBLE.has(entry.action)) return false;
  if (entry.old_value == null) return false;
  return true;
}

function truncate(s: string | null, max: number = 80): string {
  if (!s) return "(empty)";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChangeLogPage() {
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterField, setFilterField] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (filterField) params.set("field", filterField);
      if (filterAction) params.set("action", filterAction);

      const resp = await fetch(`/api/changes?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setChanges(data.changes);
      setTotal(data.total);
    } catch {
      showToast("Failed to load changes", "error");
    } finally {
      setLoading(false);
    }
  }, [page, filterField, filterAction]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleUndo(changeId: string, force = false) {
    setUndoing(changeId);
    setConflict(null);
    try {
      const resp = await fetch("/api/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId, force }),
      });
      const data = await resp.json();

      if (data.conflict) {
        setConflict(data as ConflictInfo);
        setUndoing(null);
        return;
      }

      if (!resp.ok) {
        showToast(data.error || "Undo failed", "error");
        setUndoing(null);
        return;
      }

      showToast(`✅ Restored ${data.field} on "${data.product}"`, "success");
      fetchChanges(); // Refresh list
    } catch {
      showToast("Undo request failed", "error");
    } finally {
      setUndoing(null);
    }
  }

  // Filtered by search term (client-side on product title)
  const displayed = searchTerm
    ? changes.filter((c) =>
        (c.product_title || "").toLowerCase().includes(searchTerm.toLowerCase())
      )
    : changes;

  // Group changes by date
  const grouped = displayed.reduce<Record<string, ChangeEntry[]>>((acc, c) => {
    const day = new Date(c.created_at).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!acc[day]) acc[day] = [];
    acc[day].push(c);
    return acc;
  }, {});

  const uniqueFields = [...new Set(changes.map((c) => c.field))];
  const uniqueActions = [...new Set(changes.map((c) => c.action))];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pink-900">Change Log</h1>
          <p className="text-sm text-pink-500 mt-0.5">
            Every change the AI makes to your store — with undo
          </p>
        </div>
        <button
          onClick={fetchChanges}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-md border border-pink-200 text-pink-600 hover:bg-pink-50 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search by product name…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border border-pink-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 w-56"
        />
        <select
          value={filterField}
          onChange={(e) => { setFilterField(e.target.value); setPage(0); }}
          className="px-2 py-1.5 text-sm rounded-md border border-pink-200 bg-white text-pink-700"
        >
          <option value="">All fields</option>
          {uniqueFields.map((f) => (
            <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>
          ))}
        </select>
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}
          className="px-2 py-1.5 text-sm rounded-md border border-pink-200 bg-white text-pink-700"
        >
          <option value="">All actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>
          ))}
        </select>
        {(filterField || filterAction || searchTerm) && (
          <button
            onClick={() => { setFilterField(""); setFilterAction(""); setSearchTerm(""); setPage(0); }}
            className="text-xs text-pink-400 hover:text-pink-600 underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-pink-400 ml-auto">
          {total} total changes
        </span>
      </div>

      {/* Change entries grouped by day */}
      {loading && changes.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-400" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-pink-400">
          <p className="text-lg">No changes found</p>
          <p className="text-sm mt-1">Changes will appear here as the AI modifies your store</p>
        </div>
      ) : (
        Object.entries(grouped).map(([day, entries]) => (
          <div key={day}>
            <div className="sticky top-0 bg-[var(--background)] z-10 py-1.5">
              <h2 className="text-xs font-semibold text-pink-400 uppercase tracking-wide">
                {day}
              </h2>
            </div>
            <div className="space-y-1.5">
              {entries.map((entry) => {
                const actionInfo = ACTION_LABELS[entry.action] || {
                  label: entry.action,
                  color: "bg-gray-100 text-gray-600",
                };
                const reversible = isReversible(entry);
                const isExpanded = expandedId === entry.id;
                const isUndoing = undoing === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg border transition-all ${
                      entry.action === "undo"
                        ? "border-gray-200 bg-gray-50/50"
                        : "border-pink-100 bg-white hover:border-pink-200"
                    }`}
                  >
                    {/* Main row */}
                    <div
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    >
                      {/* Action badge */}
                      <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>

                      {/* Product + field */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-pink-900 truncate block">
                          {entry.product_title || entry.product_id}
                        </span>
                        <span className="text-xs text-pink-400">
                          {FIELD_LABELS[entry.field] || entry.field}
                          {entry.source === "ui" && " · via UI"}
                        </span>
                      </div>

                      {/* Time */}
                      <span className="shrink-0 text-xs text-pink-400" title={formatDate(entry.created_at)}>
                        {timeAgo(entry.created_at)}
                      </span>

                      {/* Undo button */}
                      {reversible && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUndo(entry.id);
                          }}
                          disabled={isUndoing}
                          className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-md border border-pink-200 text-pink-600 hover:bg-pink-50 hover:border-pink-300 transition-colors disabled:opacity-50"
                        >
                          {isUndoing ? "Undoing…" : "↩ Undo"}
                        </button>
                      )}

                      {/* Expand chevron */}
                      <span className={`shrink-0 text-pink-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 border-t border-pink-50">
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div>
                            <p className="text-xs font-medium text-pink-400 mb-1">Before</p>
                            <div className="text-xs bg-red-50 text-red-800 rounded p-2 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                              {entry.old_value || "(empty)"}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-pink-400 mb-1">After</p>
                            <div className="text-xs bg-green-50 text-green-800 rounded p-2 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                              {entry.new_value || "(empty)"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-pink-400">
                          <span>{formatDate(entry.created_at)}</span>
                          <span>Source: {entry.source}</span>
                          {entry.confidence != null && (
                            <span>Confidence: {Math.round(entry.confidence * 100)}%</span>
                          )}
                          <span className="font-mono text-[10px] text-pink-300 truncate" title={entry.product_id}>
                            {entry.product_id.replace("gid://shopify/Product/", "#")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 pb-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-sm rounded border border-pink-200 text-pink-600 hover:bg-pink-50 disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-sm text-pink-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 text-sm rounded border border-pink-200 text-pink-600 hover:bg-pink-50 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}

      {/* Conflict modal */}
      {conflict && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-pink-900 text-lg">⚠️ Conflict Detected</h3>
            <p className="text-sm text-pink-700">
              <strong>{conflict.product}</strong> was modified since this change.
              The <strong>{FIELD_LABELS[conflict.field] || conflict.field}</strong> field
              no longer matches what the AI set.
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="bg-amber-50 rounded p-2">
                <span className="font-medium text-amber-700">Current live value:</span>
                <div className="mt-1 font-mono text-amber-900 break-all">
                  {truncate(conflict.currentValue, 200)}
                </div>
              </div>
              <div className="bg-blue-50 rounded p-2">
                <span className="font-medium text-blue-700">Will be restored to:</span>
                <div className="mt-1 font-mono text-blue-900 break-all">
                  {truncate(conflict.restoreValue, 200)}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConflict(null)}
                className="px-4 py-2 text-sm rounded-md border border-pink-200 text-pink-600 hover:bg-pink-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleUndo(conflict.changeId, true);
                  setConflict(null);
                }}
                className="px-4 py-2 text-sm rounded-md bg-pink-600 text-white hover:bg-pink-700"
              >
                Override & Undo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-sm z-50 transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
