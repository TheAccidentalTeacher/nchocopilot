"use client";

import { useState, useEffect } from "react";

interface BlogArticle {
  id: string;
  title: string;
  handle: string;
  publishedAt: string | null;
  createdAt: string;
  author: { name: string };
}

interface GeneratedPost {
  title: string;
  body: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
}

export default function BlogPage() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // New post form
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<GeneratedPost | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        const allArticles: BlogArticle[] = [];
        for (const blog of data.blogs || []) {
          for (const article of blog.articles || []) {
            allArticles.push(article);
          }
        }
        setArticles(allArticles);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setDraftError(null);
    setDraft(null);

    try {
      const resp = await fetch("/api/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), keywords: keywords.trim() || undefined }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setDraft(data);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-pink-100 rounded w-48" />
        <div className="h-20 bg-pink-100/60 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pink-900">Blog Publisher</h1>
          <p className="text-sm text-pink-400 mt-1">
            {articles.length} articles published
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setDraft(null);
            setDraftError(null);
          }}
          className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
        >
          {showForm ? "Cancel" : "📝 New Post"}
        </button>
      </div>

      {/* New Post Form */}
      {showForm && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-pink-800">Generate a Blog Post</h2>

          <div>
            <label className="block text-sm font-medium text-pink-800 mb-1">
              Topic *
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Best math curriculum for 3rd graders"
              className="w-full border border-pink-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 focus:border-pink-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-pink-800 mb-1">
              Keywords (optional)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g., homeschool math, elementary, hands-on"
              className="w-full border border-pink-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-pink-400 focus:border-pink-400"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generating..." : "🤖 Generate Draft"}
          </button>

          {draftError && (
            <p className="text-sm text-pink-600">{draftError}</p>
          )}
        </div>
      )}

      {/* Draft Preview */}
      {draft && (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-pink-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-pink-900">
                Draft Preview
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const fullText = `# ${draft.title}\n\n${draft.body.replace(/<[^>]*>/g, "")}`;
                    navigator.clipboard.writeText(fullText);
                  }}
                  className="px-3 py-1.5 text-sm bg-pink-50 rounded-lg hover:bg-pink-100 transition-colors"
                >
                  📋 Copy Text
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(draft.body);
                  }}
                  className="px-3 py-1.5 text-sm bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
                >
                  📋 Copy HTML
                </button>
                <button
                  disabled
                  className="px-3 py-1.5 text-sm bg-pink-500 text-white rounded-lg opacity-50 cursor-not-allowed"
                  title="Requires write_content scope"
                >
                  🚀 Publish to Shopify
                </button>
              </div>
            </div>

            {/* SEO Preview */}
            <div className="bg-sky-50/50 rounded-lg p-3 mb-4">
              <p className="text-xs text-sky-400 mb-1">SEO Preview</p>
              <p className="text-sky-700 font-medium">{draft.seoTitle}</p>
              <p className="text-green-700 text-xs">
                nextchapterhomeschool.com/blogs/news/...
              </p>
              <p className="text-sky-600 text-sm">{draft.seoDescription}</p>
            </div>

            <p className="text-sm text-pink-400">
              <strong>Excerpt:</strong> {draft.excerpt}
            </p>
          </div>

          <div className="p-6">
            <h1 className="text-2xl font-bold text-pink-900 mb-4">
              {draft.title}
            </h1>
            <div
              className="prose prose-sm max-w-none text-pink-900/80"
              dangerouslySetInnerHTML={{ __html: draft.body }}
            />
          </div>
        </div>
      )}

      {/* Existing Articles */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-pink-100 shadow-sm">
        <div className="p-4 border-b border-pink-100">
          <h2 className="font-semibold text-pink-800">
            Published Articles ({articles.length})
          </h2>
        </div>
        {articles.length === 0 ? (
          <div className="p-8 text-center text-pink-400">
            <p className="text-lg mb-1">No blog articles yet</p>
            <p className="text-sm">
              Click &quot;New Post&quot; to generate your first one with AI.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {articles.map((a) => (
              <div key={a.id} className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-pink-900">{a.title}</h3>
                  <p className="text-xs text-pink-400">
                    By {a.author?.name || "Unknown"} ·{" "}
                    {a.publishedAt
                      ? new Date(a.publishedAt).toLocaleDateString()
                      : "Draft"}
                  </p>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    a.publishedAt
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-pink-50 text-pink-500"
                  }`}
                >
                  {a.publishedAt ? "Published" : "Draft"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg p-4 text-sm">
        <strong>Note:</strong> Publishing directly to Shopify requires
        write_content scope. For now, generate the post here, copy the HTML, and
        paste it into Shopify admin → Blog posts → Add blog post.
      </div>
    </div>
  );
}
