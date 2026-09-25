"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/room-types";

const CLOSED_KEY = "wikirace.chat-closed";

/**
 * Text drawn by CSS (a ::before with the text in data-text) rather than put
 * in the page, so the browser's find (Ctrl+F) only searches the article.
 */
function Unfindable({ text, className = "" }: { text: string; className?: string }) {
  return <span className={`nofind ${className}`} data-text={text} />;
}

function loadClosed(): boolean {
  try {
    return localStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveClosed(closed: boolean) {
  try {
    if (closed) localStorage.setItem(CLOSED_KEY, "1");
    else localStorage.removeItem(CLOSED_KEY);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

interface ChatProps {
  messages: ChatMessage[]; // the latest few, oldest first
  total: number; // messages received so far, for the unread count
  onSend: (text: string) => Promise<void>;
}

/** Small room chat in the bottom-right corner: the last few messages and a box to type in. */
export function Chat({ messages, total, onSend }: ChatProps) {
  const [closed, setClosed] = useState(loadClosed);
  const [seen, setSeen] = useState(total); // total when last closed
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unread = closed ? total - seen : 0;

  function toggle(next: boolean) {
    if (next) setSeen(total);
    setClosed(next);
    saveClosed(next);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const draft = text;
    setText("");
    setError(null);
    try {
      await onSend(draft);
    } catch (err) {
      setText((t) => t || draft);
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    }
  }

  if (closed) {
    return (
      <button
        onClick={() => toggle(false)}
        aria-label={unread ? `Open chat, ${unread} new` : "Open chat"}
        className="chat-box btn-line fixed bottom-3 right-3 z-30 px-3 py-1.5 text-sm"
      >
        <Unfindable text={unread ? `Chat · ${unread}` : "Chat"} />
      </button>
    );
  }

  return (
    <aside
      aria-label="Room chat"
      className="chat-box frame fixed bottom-3 right-3 z-30 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col bg-surface"
    >
      <div className="flex items-center justify-between border-b-2 border-ink px-3 py-1.5">
        <Unfindable text="Chat" className="kicker" />
        <button
          onClick={() => toggle(true)}
          aria-label="Close chat"
          title="Close chat"
          className="grid size-6 place-items-center text-base leading-none text-muted hover:text-ink"
        >
          ×
        </button>
      </div>
      <ul aria-live="polite" className="max-h-40 space-y-1 overflow-y-auto px-3 py-2 text-sm leading-snug">
        {messages.length === 0 ? (
          <li className="text-muted">
            <Unfindable text="No messages yet." />
          </li>
        ) : (
          messages.map((m) => (
            <li key={m.id} aria-label={`${m.name}: ${m.text}`} className="chat-line">
              <Unfindable text={m.name} className="font-bold" />
              <Unfindable text={`: ${m.text}`} />
            </li>
          ))
        )}
      </ul>
      {error && (
        <p role="alert" className="px-3 pb-1 text-xs font-semibold text-muted">
          <Unfindable text={error} />
        </p>
      )}
      <form onSubmit={send} className="flex gap-2 border-t-2 border-ink p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something..."
          aria-label="Chat message"
          autoComplete="off"
          className="chat-input frame min-w-0 flex-1 bg-bg px-2.5 py-1.5 text-sm outline-none focus:shadow-[3px_3px_0_var(--ink)]"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send" className="btn-ink px-3 py-1.5 text-xs">
          <Unfindable text="Send" />
        </button>
      </form>
    </aside>
  );
}
