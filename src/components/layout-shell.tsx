"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ChatPanel from "./chat-panel";

export default function LayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // Chat always open, resizable via drag handle
  const [chatWidth, setChatWidth] = useState(50); // percentage of viewport
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load saved width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ncho-chat-width");
    if (saved) {
      const pct = parseInt(saved, 10);
      if (pct >= 25 && pct <= 75) setChatWidth(pct);
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const vw = window.innerWidth;
      // Chat is on the right, so chat width = 100% - (mouse X / vw * 100)
      const pct = Math.round(100 - (e.clientX / vw) * 100);
      const clamped = Math.max(25, Math.min(75, pct));
      setChatWidth(clamped);
    };
    const onMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem("ncho-chat-width", String(chatWidth));
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [chatWidth]);

  return (
    <div ref={containerRef} className="flex flex-1 min-h-screen relative">
      {/* Main content */}
      <main
        className="flex-1 p-8 overflow-auto"
        style={{ width: `${100 - chatWidth}%` }}
      >
        {children}
      </main>

      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1.5 cursor-col-resize bg-pink-200 hover:bg-pink-400 active:bg-pink-500 transition-colors flex-shrink-0 relative group z-50"
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-1 h-8 rounded-full bg-pink-300 group-hover:bg-pink-500 transition-colors" />
      </div>

      {/* Chat panel — always visible */}
      <div
        className="h-screen bg-gradient-to-b from-white to-pink-50/30 border-l border-pink-200 shadow-xl flex flex-col flex-shrink-0"
        style={{ width: `${chatWidth}%` }}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-pink-100 bg-white/80">
          <span className="text-sm font-semibold text-pink-700">
            🤖 Store Assistant
          </span>
          <span className="text-xs text-pink-300">{chatWidth}%</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
