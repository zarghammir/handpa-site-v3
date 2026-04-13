// ChatWidget.jsx
//
// What this teaches:
//   → Session management with localStorage (persists across page refreshes)
//   → Multi-turn conversation state in React
//   → Calling your own API with full message history
//   → Cleanup on unmount — sending chat-end when widget closes
//   → useRef for scrolling the message list to the bottom

import { useState, useEffect, useRef, useCallback } from "react";

// Generates a unique session ID for this visitor.
// Stored in localStorage so refreshing the page continues the same session.
function getOrCreateSessionId() {
  const key = "handpan_chat_session";
  let id = localStorage.getItem(key);
  if (!id) {
    id = "sess_" + Math.random().toString(36).slice(2, 11);
    localStorage.setItem(key, id);
  }
  return id;
}

// Strips action markers from assistant messages before displaying them.
// The user should never see [SAVE_LEAD ...] or [CHECK_AVAILABILITY] etc.
function cleanReply(text) {
  return text
    .replace(/\[SAVE_LEAD[^\]]*\]/g, "")
    .replace(/\[CHECK_AVAILABILITY[^\]]*\]/g, "")
    .replace(/\[CREATE_BOOKING[^\]]*\]/g, "")
    .replace(/\[SYSTEM ACTION RESULT[^\]]*\]/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold** → bold
    .replace(/\*(.+?)\*/g, "$1") // *italic* → italic
    .replace(/^#+\s/gm, "") // ## headers → plain text
    .replace(/^[-•]\s/gm, "") // - bullet or • bullet → plain
    .trim();
}

const INITIAL_MESSAGE = {
  role: "assistant",
  content:
    "Howdy! 👋 I'm Nava, Medya's assistant. Ask me anything about handpan lessons, or I can help you book a free session!",
};

const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => getOrCreateSessionId());
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when widget opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Send summary email when widget is closed
  // useCallback so we can safely use it in the cleanup
  const sendChatEnd = useCallback(() => {
    // Only send if there was an actual conversation (more than just the greeting)
    if (messages.length <= 1) return;

    // navigator.sendBeacon is perfect here — it sends the request even if
    // the page is being unloaded, unlike fetch() which can be cancelled
    const payload = JSON.stringify({ sessionId });
    navigator.sendBeacon(
      "/api/chat-end",
      new Blob([payload], { type: "application/json" }),
    );
  }, [messages.length, sessionId]);

  // Start/reset a 15-min inactivity timer after each new message.
  // When it fires, send the summary email just like closing the widget does.
  // The server guards against duplicate emails via the email_sent flag.
  useEffect(() => {
    if (messages.length <= 1) return;

    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      sendChatEnd();
    }, INACTIVITY_MS);

    return () => clearTimeout(inactivityTimerRef.current);
  }, [messages, sendChatEnd]);

  // Send summary when widget is closed by the user
  const handleClose = () => {
    clearTimeout(inactivityTimerRef.current);
    setOpen(false);
    sendChatEnd();
  };

  // Also send summary if the user leaves the page with widget open
  useEffect(() => {
    const handleUnload = () => {
      clearTimeout(inactivityTimerRef.current);
      if (open && messages.length > 1) sendChatEnd();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [open, sendChatEnd]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Optimistically add user message to UI immediately
    const userMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only send user/assistant messages — not the initial greeting
          // since that's not a real message Claude needs context from
          messages: updatedMessages.filter((m) => m !== INITIAL_MESSAGE),
          sessionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cleanReply(data.reply) },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, something went wrong. Please try again or use the contact form.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-[9999] w-[90vw] max-w-sm flex flex-col rounded-3xl border border-sand bg-white shadow-2xl overflow-hidden"
          style={{ height: "min(600px, 80vh)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-forest">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-orange flex items-center justify-center text-white font-bold text-sm">
                M
              </div>
              <div>
                <p className="text-cream font-bold text-sm leading-tight">
                  Nava
                </p>
                <p className="text-cream/50 text-xs">Ask me anything</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close chat"
              className="text-cream/50 hover:text-cream transition-colors text-xl leading-none"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-cream/30">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-orange text-white rounded-br-sm"
                      : "bg-white text-forest border border-sand rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-sand rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    <span
                      className="w-1.5 h-1.5 bg-forest/30 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-forest/30 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-1.5 h-1.5 bg-forest/30 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-sand bg-white flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-forest/15 bg-cream px-3 py-2.5 text-sm text-forest placeholder:text-forest/35 outline-none focus:border-orange transition-colors"
              style={{ maxHeight: "100px" }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="w-10 h-10 rounded-2xl bg-orange text-white flex items-center justify-center hover:bg-orange/90 transition-all disabled:opacity-40 shrink-0"
            >
              <svg
                className="w-4 h-4 rotate-90"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Floating bubble ───────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-5 right-5 z-[9999] w-14 h-14 rounded-full bg-orange text-white shadow-lg hover:bg-orange/90 hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
      >
        {open ? (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
      </button>
    </>
  );
}
