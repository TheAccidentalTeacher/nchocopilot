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

interface Attachment {
  type: "image" | "file";
  name: string;
  mimeType: string;
  /** base64 data (no prefix) for images, full text content for files */
  data: string;
  /** data URL for image preview */
  preview?: string;
}

const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const SUPPORTED_FILE_TYPES = [
  "text/plain", "text/csv", "text/html", "text/markdown",
  "application/json", "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function ChatPanel() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [showThreads, setShowThreads] = useState(true);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [queuedMessage, setQueuedMessage] = useState<{ text: string; attachments: Attachment[] } | null>(null);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
      setThreadError(null);
      const resp = await fetch("/api/threads");
      if (resp.ok) {
        const data = await resp.json();
        setThreads(Array.isArray(data) ? data : []);
      } else {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        console.error("Threads fetch failed:", err);
        setThreadError(err.error || `HTTP ${resp.status}`);
      }
    } catch (err) {
      console.error("Threads fetch error:", err);
      setThreadError("Failed to connect to database");
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

  const renameThread = async (id: string, newTitle: string) => {
    const title = newTitle.trim();
    if (!title) {
      setEditingThreadId(null);
      return;
    }
    try {
      await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title } : t))
      );
      if (activeThread?.id === id) {
        setActiveThread((prev) => (prev ? { ...prev, title } : prev));
      }
    } catch { /* ignore */ }
    setEditingThreadId(null);
  };

  // --- Attachment handling ---
  const processFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      alert(`File too large: ${file.name} (max 10 MB)`);
      return;
    }

    if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        setAttachments((prev) => [
          ...prev,
          {
            type: "image",
            name: file.name,
            mimeType: file.type,
            data: base64,
            preview: dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    } else if (
      SUPPORTED_FILE_TYPES.includes(file.type) ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".txt")
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            type: "file",
            name: file.name,
            mimeType: file.type || "text/plain",
            data: reader.result as string,
          },
        ]);
      };
      reader.readAsText(file);
    } else {
      alert(
        `Unsupported file type: ${file.type || file.name}\nSupported: images (PNG, JPG, GIF, WebP), text, CSV, JSON, Markdown`
      );
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processFile(file);
          return;
        }
      }
      // If no image found, let normal text paste happen
    },
    [processFile]
  );

  const handleFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        processFile(file);
      }
      // Reset so the same file can be picked again
      e.target.value = "";
    },
    [processFile]
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
    if (!msg && attachments.length === 0) return;

    // If already streaming, queue this message for after
    if (streaming) {
      setQueuedMessage({ text: msg, attachments: [...attachments] });
      setInput("");
      setAttachments([]);
      return;
    }

    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);
    setStreaming(true);
    setStreamText("");
    setToolEvents([]);

    // Build display text showing what was sent
    const attachmentLabels = currentAttachments.map((a) =>
      a.type === "image" ? `📷 ${a.name}` : `📄 ${a.name}`
    );
    const displayContent = [
      msg,
      ...attachmentLabels,
    ].filter(Boolean).join("\n");

    // Optimistically add user message
    const userMsg: ChatMessage = {
      role: "user",
      content: displayContent,
      timestamp: new Date().toISOString(),
    };

    const currentMessages = activeThread?.messages || [];
    const optimisticThread: ChatThread = activeThread
      ? { ...activeThread, messages: [...currentMessages, userMsg] }
      : {
          id: "",
          title: (msg || currentAttachments[0]?.name || "New Chat").slice(0, 40),
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
          message: msg || "(see attached)",
          attachments: currentAttachments.map((a) => ({
            type: a.type,
            name: a.name,
            mimeType: a.mimeType,
            data: a.data,
          })),
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

        // Parse SSE: split on double newline to get complete events
        const events = accumulated.split("\n\n");
        // Keep the last chunk if it's incomplete (no trailing \n\n)
        accumulated = events.pop() || "";

        for (const block of events) {
          if (!block.trim()) continue;
          const lines = block.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!eventType || !dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            switch (eventType) {
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
                      // Auto-title new threads based on first message
                      if (full.title === "New Chat" && msg) {
                        const autoTitle = msg.slice(0, 50) + (msg.length > 50 ? "…" : "");
                        fetch(`/api/threads/${threadId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: autoTitle }),
                        }).catch(() => {});
                        setActiveThread({ ...full, title: autoTitle });
                      }
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
    } catch (err) {
      setStreamText(
        `❌ ${err instanceof Error ? err.message : "Connection failed"}`
      );
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, activeThread, attachments]);

  // Process queued message after streaming ends
  useEffect(() => {
    if (!streaming && queuedMessage) {
      const { text, attachments: qAttachments } = queuedMessage;
      setQueuedMessage(null);
      // Populate input and attachments, then trigger send on next tick
      setInput(text);
      setAttachments(qAttachments);
      const timer = setTimeout(() => {
        // sendMessage reads from state, so we need to trigger it after state settles
        document.getElementById("ncho-send-btn")?.click();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [streaming, queuedMessage]);

  // Voice input
  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setInput((prev) => {
        const base = prev.replace(/\[listening\.\.\.\].*$/, "").trimEnd();
        const space = base ? " " : "";
        if (finalTranscript) {
          return base + space + finalTranscript + (interim ? " " + interim : "");
        }
        return base + (interim ? space + interim : "");
      });
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      inputRef.current?.focus();
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening]);

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
            {threadError ? (
              <div className="p-3 text-xs text-red-500">
                <p className="font-medium">⚠️ DB Error:</p>
                <p className="mt-1">{threadError}</p>
                <button
                  onClick={loadThreads}
                  className="mt-2 px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                >
                  Retry
                </button>
              </div>
            ) : threads.length === 0 ? (
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
                  {editingThreadId === t.id ? (
                    <input
                      autoFocus
                      className="flex-1 text-sm bg-white border border-pink-300 rounded px-1 py-0.5 text-pink-800 outline-none focus:border-pink-500"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameThread(t.id, editTitle);
                        if (e.key === "Escape") setEditingThreadId(null);
                      }}
                      onBlur={() => renameThread(t.id, editTitle)}
                    />
                  ) : (
                    <button
                      onClick={() => selectThread(t)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingThreadId(t.id);
                        setEditTitle(t.title);
                      }}
                      className="flex-1 text-left truncate"
                      title="Double-click to rename"
                    >
                      {t.title}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingThreadId(t.id);
                      setEditTitle(t.title);
                    }}
                    className="hidden group-hover:block text-pink-300 hover:text-pink-600 ml-1"
                    title="Rename"
                  >
                    ✎
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
          {activeThread && (
            <button
              onClick={() => {
                setEditingThreadId(activeThread.id);
                setEditTitle(activeThread.title);
                setShowThreads(true);
              }}
              className="text-pink-300 hover:text-pink-600 text-xs"
              title="Rename chat"
            >
              ✎
            </button>
          )}
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

        {/* Thinking indicator bar */}
        {streaming && (
          <div className="px-4 py-2 border-t border-pink-100 bg-gradient-to-r from-pink-50 via-sky-50 to-pink-50 flex items-center gap-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-pink-500 font-medium">
              {toolEvents.length > 0 && !toolEvents[toolEvents.length - 1].result
                ? `Working on it — using ${toolEvents[toolEvents.length - 1].tool}...`
                : streamText
                  ? "Writing response..."
                  : "Thinking..."}
            </span>
            {queuedMessage && (
              <span className="text-xs text-sky-500 ml-auto">Your next message is queued ✓</span>
            )}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-pink-100 bg-white/60">
          {/* Attachment previews */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((att, i) => (
                <div
                  key={i}
                  className="relative group rounded-lg border border-pink-200 bg-white overflow-hidden"
                >
                  {att.type === "image" && att.preview ? (
                    <img
                      src={att.preview}
                      alt={att.name}
                      className="h-16 w-16 object-cover"
                    />
                  ) : (
                    <div className="h-16 px-3 flex items-center gap-1.5 text-xs text-pink-600">
                      <span>📄</span>
                      <span className="max-w-[120px] truncate">{att.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/gif,image/webp,.csv,.json,.txt,.md,.html,.pdf"
              onChange={handleFilePick}
              className="hidden"
            />
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-2.5 text-pink-400 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-colors"
              title="Attach file or image (or paste a screenshot)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            {/* Voice input button */}
            <button
              onClick={toggleVoice}
              className={`px-2.5 py-2.5 rounded-xl transition-colors ${
                listening
                  ? "text-red-500 bg-red-50 hover:bg-red-100 animate-pulse"
                  : "text-pink-400 hover:text-pink-600 hover:bg-pink-50"
              }`}
              title={listening ? "Stop listening" : "Voice input"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                listening
                  ? "Listening..."
                  : streaming
                    ? "Type to queue your next message..."
                    : attachments.length > 0
                      ? "Add a message about these files..."
                      : "Ask Anna's assistant anything... (paste screenshots here!)"
              }
              rows={1}
              className={`flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-pink-400 focus:border-pink-400 placeholder:text-pink-300 ${
                listening ? "border-red-300 bg-red-50/30" : "border-pink-200"
              }`}
              style={{ minHeight: "42px", maxHeight: "120px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "42px";
                target.style.height = target.scrollHeight + "px";
              }}
            />
            <button
              id="ncho-send-btn"
              onClick={sendMessage}
              disabled={!input.trim() && attachments.length === 0}
              className="px-4 py-2.5 bg-pink-500 text-white rounded-xl hover:bg-pink-600 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {streaming ? (queuedMessage ? "Queued ✓" : "Queue") : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
