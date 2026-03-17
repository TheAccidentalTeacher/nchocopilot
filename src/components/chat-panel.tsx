"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  pinned: boolean;
  updated_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCallRecord[];
  timestamp: string;
}

interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  result: string;
}

interface ToolEvent {
  tool: string;
  input?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export default function ChatPanel() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [showThreads, setShowThreads] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load threads on mount
  useEffect(() => {
    loadThreads();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages, streamText]);

  const loadThreads = async () => {
    try {
      const resp = await fetch("/api/threads");
      if (resp.ok) {
        const data = await resp.json();
        setThreads(data);
      }
    } catch {
      // Supabase not configured yet — work without threads
    }
  };

  const selectThread = async (thread: ChatThread) => {
    try {
      const resp = await fetch(`/api/threads/${thread.id}`);
      if (resp.ok) {
        const full = await resp.json();
        setActiveThread(full);
      }
    } catch {
      setActiveThread(thread);
    }
  };

  const newThread = async () => {
    setActiveThread(null);
    setStreamText("");
    setToolEvents([]);
    setInput("");
    inputRef.current?.focus();
  };

  const deleteThread = async (id: string) => {
    try {
      await fetch(`/api/threads/${id}`, { method: "DELETE" });
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeThread?.id === id) {
        setActiveThread(null);
      }
    } catch { /* ignore */ }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const resp = await fetch("/api/sync", { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        // Show sync result as a system message
        if (activeThread) {
          const syncMsg: ChatMessage = {
            role: "assistant",
            content: `🔄 Store synced! ${data.stats.totalProducts} products, ${data.stats.withSeo} with SEO, ${data.stats.collections} collections.`,
            timestamp: new Date().toISOString(),
          };
          setActiveThread({
            ...activeThread,
            messages: [...activeThread.messages, syncMsg],
          });
        }
      }
    } catch { /* ignore */ }
    setSyncing(false);
  };

  const sendMessage = useCallback(async () => {
    const msg = input.trim();
    if (!msg || streaming) return;

    setInput("");
    setStreaming(true);
    setStreamText("");
    setToolEvents([]);

    // Optimistically add user message
    const userMsg: ChatMessage = {
      role: "user",
      content: msg,
      timestamp: new Date().toISOString(),
    };

    const currentMessages = activeThread?.messages || [];
    const optimisticThread: ChatThread = activeThread
      ? { ...activeThread, messages: [...currentMessages, userMsg] }
      : {
          id: "",
          title: msg.slice(0, 40),
          messages: [userMsg],
          pinned: false,
          updated_at: new Date().toISOString(),
        };
    setActiveThread(optimisticThread);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThread?.id || null,
          message: msg,
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let accumulated = "";
      let threadId = activeThread?.id || "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });
        const lines = accumulated.split("\n");
        accumulated = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const event = line.slice(7);
            const dataLine = lines[lines.indexOf(line) + 1];
            if (!dataLine?.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(dataLine.slice(6));

              switch (event) {
                case "thread":
                  threadId = data.id;
                  break;
                case "text":
                  setStreamText((prev) => prev + data.content);
                  break;
                case "tool_start":
                  setToolEvents((prev) => [
                    ...prev,
                    { tool: data.tool, input: data.input },
                  ]);
                  break;
                case "tool_result":
                  setToolEvents((prev) => {
                    const copy = [...prev];
                    const last = copy.findLast(
                      (e) => e.tool === data.tool && !e.result
                    );
                    if (last) last.result = data.result;
                    return copy;
                  });
                  break;
                case "done":
                  // Reload thread to get final saved state
                  if (threadId) {
                    try {
                      const threadResp = await fetch(
                        `/api/threads/${threadId}`
                      );
                      if (threadResp.ok) {
                        const full = await threadResp.json();
                        setActiveThread(full);
                      }
                    } catch { /* ignore */ }
                  }
                  loadThreads();
                  break;
                case "error":
                  setStreamText(
                    (prev) => prev + `\n\n❌ Error: ${data.message}`
                  );
                  break;
              }
            } catch {
              // Skip malformed SSE
            }
          }
        }
      }
    } catch (err) {
      setStreamText(
        `❌ ${err instanceof Error ? err.message : "Connection failed"}`
      );
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, activeThread]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const displayMessages = activeThread?.messages || [];

  return (
    <div className="flex h-full">
      {/* Thread sidebar */}
      {showThreads && (
        <div className="w-56 border-r border-pink-100 bg-white/60 flex flex-col">
          <div className="p-3 border-b border-pink-100 flex items-center justify-between">
            <span className="text-sm font-medium text-pink-700">Chats</span>
            <button
              onClick={newThread}
              className="text-xs px-2 py-1 bg-pink-100 text-pink-600 rounded hover:bg-pink-200 transition-colors"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="p-3 text-xs text-pink-300">No conversations yet</p>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-center px-3 py-2 text-sm cursor-pointer hover:bg-pink-50 transition-colors ${
                    activeThread?.id === t.id
                      ? "bg-pink-100/60 text-pink-800"
                      : "text-pink-600"
                  }`}
                >
                  <button
                    onClick={() => selectThread(t)}
                    className="flex-1 text-left truncate"
                  >
                    {t.title}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteThread(t.id);
                    }}
                    className="hidden group-hover:block text-pink-300 hover:text-pink-600 ml-1"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="p-2 border-t border-pink-100">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full text-xs px-2 py-1.5 bg-sky-50 text-sky-600 rounded hover:bg-sky-100 transition-colors disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "🔄 Sync Store"}
            </button>
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-pink-100 bg-white/60">
          <button
            onClick={() => setShowThreads(!showThreads)}
            className="text-pink-400 hover:text-pink-600"
          >
            {showThreads ? "◀" : "▶"}
          </button>
          <span className="text-sm font-medium text-pink-700 truncate">
            {activeThread?.title || "New Chat"}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayMessages.length === 0 && !streamText && (
            <div className="text-center py-12">
              <p className="text-lg text-pink-300 mb-2">👋 Hi Anna!</p>
              <p className="text-sm text-pink-400/70 max-w-md mx-auto">
                I&apos;m your store assistant. Ask me to tag products, write SEO
                descriptions, classify inventory, generate blog posts, or
                anything else about the store.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  "Show me products without SEO",
                  "How many products need grade tags?",
                  "Write a blog post about math curriculum",
                  "Classify the Ravensburger products",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="text-xs px-3 py-1.5 bg-pink-50 text-pink-500 rounded-full hover:bg-pink-100 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-pink-500 text-white"
                    : "bg-white/80 border border-pink-100 text-pink-900"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.tool_calls.map((tc, j) => (
                      <div
                        key={j}
                        className="text-xs bg-sky-50 text-sky-700 rounded px-2 py-1"
                      >
                        🔧 {tc.tool}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {(streaming || streamText) && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-xl px-4 py-2.5 bg-white/80 border border-pink-100 text-pink-900">
                {/* Tool activity indicators */}
                {toolEvents.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {toolEvents.map((te, i) => (
                      <div
                        key={i}
                        className="text-xs bg-sky-50 text-sky-600 rounded px-2 py-1 flex items-center gap-1"
                      >
                        {te.result ? "✅" : "⏳"} {te.tool}
                        {te.result && "result" in te.result && (
                          <span className="text-sky-400 ml-1">
                            {typeof (te.result as Record<string, unknown>).success === "boolean"
                              ? (te.result as Record<string, unknown>).success
                                ? "— done"
                                : "— failed"
                              : ""}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap">
                  {streamText}
                  {streaming && !streamText && (
                    <span className="animate-pulse">Thinking...</span>
                  )}
                  {streaming && streamText && (
                    <span className="animate-pulse">▌</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-pink-100 bg-white/60">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Anna's assistant anything..."
              rows={1}
              className="flex-1 resize-none border border-pink-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:border-pink-400 placeholder:text-pink-300"
              style={{ minHeight: "42px", maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "42px";
                target.style.height = target.scrollHeight + "px";
              }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="px-4 py-2.5 bg-pink-500 text-white rounded-xl hover:bg-pink-600 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {streaming ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
