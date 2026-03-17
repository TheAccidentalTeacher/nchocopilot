"use client";

import { useState } from "react";
import ChatPanel from "./chat-panel";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex flex-1 min-h-screen relative">
      {/* Main content */}
      <main
        className={`flex-1 p-8 overflow-auto transition-all ${chatOpen ? "mr-[480px]" : ""}`}
      >
        {children}
      </main>

      {/* Chat toggle button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-pink-500 text-white rounded-full shadow-lg hover:bg-pink-600 transition-all hover:scale-105 flex items-center justify-center text-xl z-50"
          title="Open store assistant"
        >
          💬
        </button>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <div className="fixed top-0 right-0 w-[480px] h-screen bg-gradient-to-b from-white to-pink-50/30 border-l border-pink-200 shadow-xl z-40 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-pink-100 bg-white/80">
            <span className="text-sm font-semibold text-pink-700">
              🤖 Store Assistant
            </span>
            <button
              onClick={() => setChatOpen(false)}
              className="text-pink-400 hover:text-pink-600 text-lg"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        </div>
      )}
    </div>
  );
}
