"use client";

import { useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/room-types";

const CLOSED_KEY = "wikirace.chat-closed";
const OPACITY_KEY = "wikirace.chat-opacity";
const POPUP_MS = 6000; // how long new messages stay up while the chat is closed
const MIN_OPACITY = 20; // percent

/**
 * Text drawn by CSS (a ::before with the text in data-text) rather than put
 * in the page, so the browser's find (Ctrl+F) only searches the article.
 */
function Unfindable({ text, className = "" }: { text: string; className?: string }) {
  return <span className={`nofind ${className}`} data-text={text} />;
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

function loadOpacity(): number {
  const n = Number(load(OPACITY_KEY));
  return n >= MIN_OPACITY && n <= 100 ? n : 100;
}

function Line({ m }: { m: ChatMessage }) {
  return (
    <>
      <Unfindable text={m.name} className="font-bold" />
      <Unfindable text={`: ${m.text}`} />
    </>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface ChatProps {
  messages: ChatMessage[]; // the latest few, oldest first
  total: number; // messages received so far, for the unread count
  onSend: (text: string) => Promise<void>;
}

/** Small room chat in the bottom-right corner: the last few messages and a box to type in. */
export function Chat({ messages, total, onSend }: ChatProps) {
  const [closed, setClosed] = useState(() => load(CLOSED_KEY) === "1");
  const [seen, setSeen] = useState(total); // total when last closed
  const [poppedDown, setPoppedDown] = useState(total); // total when the popups last went away
  const [opacity, setOpacity] = useState(loadOpacity);
  const [settings, setSettings] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unread = closed ? total - seen : 0;

  // While closed, new messages pop up above the button for a few seconds.
  const popups = closed && total > poppedDown ? messages.slice(-Math.min(total - poppedDown, messages.length)) : [];
  const popping = popups.length > 0;
  useEffect(() => {
    if (!popping) return;
    const t = setTimeout(() => setPoppedDown(total), POPUP_MS);
    return () => clearTimeout(t);
  }, [popping, total]);

  function toggle(next: boolean) {
    // Only messages that arrive after this moment count as new or pop up.
    setSeen(total);
    setPoppedDown(total);
    setClosed(next);
    save(CLOSED_KEY, next ? "1" : null);
  }

  function changeOpacity(n: number) {
    setOpacity(n);
    save(OPACITY_KEY, String(n));
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
      <div className="fixed bottom-3 right-3 z-30 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2">
        {popups.length > 0 && (
          <ul aria-live="polite" className="flex w-full flex-col items-end gap-1.5">
            {popups.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => toggle(false)}
                  aria-label={`${m.name}: ${m.text}. Open chat`}
                  className="chat-popup frame chat-line max-w-full bg-surface px-3 py-1.5 text-left text-sm leading-snug"
                >
                  <Line m={m} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => toggle(false)}
          aria-label={unread ? `Open chat, ${unread} new` : "Open chat"}
          className="chat-box btn-line px-3 py-1.5 text-sm"
        >
          <Unfindable text={unread ? `Chat · ${unread}` : "Chat"} />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Room chat"
      style={{ opacity: opacity / 100 }}
      className="chat-box frame fixed bottom-3 right-3 z-30 flex w-72 max-w-[calc(100vw-1.5rem)] flex-col bg-surface"
    >
      <div className="flex items-center gap-1 border-b-2 border-ink px-3 py-1.5">
        <Unfindable text="Chat" className="kicker mr-auto" />
        <button
          onClick={() => setSettings((s) => !s)}
          aria-label="Chat settings"
          aria-expanded={settings}
          title="Chat settings"
          className={`grid size-6 place-items-center hover:text-ink ${settings ? "text-ink" : "text-muted"}`}
        >
          <GearIcon />
        </button>
        <button
          onClick={() => toggle(true)}
          aria-label="Close chat"
          title="Close chat"
          className="grid size-6 place-items-center text-base leading-none text-muted hover:text-ink"
        >
          ×
        </button>
      </div>
      {settings && (
        <label className="flex items-center gap-2.5 border-b border-hair px-3 py-2 text-xs">
          <Unfindable text="Opacity" className="kicker text-muted" />
          <input
            type="range"
            min={MIN_OPACITY}
            max={100}
            step={5}
            value={opacity}
            onChange={(e) => changeOpacity(Number(e.target.value))}
            aria-label="Chat opacity"
            className="chat-range min-w-0 flex-1"
          />
          <Unfindable text={`${opacity}%`} className="w-8 text-right tabular-nums" />
        </label>
      )}
      <ul aria-live="polite" className="max-h-52 space-y-1 overflow-y-auto px-3 py-2 text-sm leading-snug">
        {messages.length === 0 ? (
          <li className="text-muted">
            <Unfindable text="No messages yet." />
          </li>
        ) : (
          messages.map((m) => (
            <li key={m.id} aria-label={`${m.name}: ${m.text}`} className="chat-line">
              <Line m={m} />
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
          className="chat-input frame min-w-0 flex-1 bg-bg px-2.5 py-1.5 text-sm"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send" className="btn-ink px-3 py-1.5 text-xs">
          <Unfindable text="Send" />
        </button>
      </form>
    </aside>
  );
}
