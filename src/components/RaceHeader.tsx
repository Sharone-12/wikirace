"use client";

import { useState, type ReactNode } from "react";
import { Trail } from "@/components/RouteLine";

interface RaceHeaderProps {
  target: string;
  targetExtract: string;
  clicks: number;
  timeLeft: number; // seconds
  timeLimit: number; // seconds
  path: string[];
  canGoBack: boolean;
  busy: boolean;
  onBack: () => void;
  onGiveUp: () => void;
  children?: ReactNode; // extra row, e.g. other players' progress
}

/** Sticky in-race header: time bar, target, clicks, clock, Back, trail, Give up. */
export function RaceHeader(p: RaceHeaderProps) {
  const [showExtract, setShowExtract] = useState(false);
  const mm = Math.floor(p.timeLeft / 60);
  const ss = String(p.timeLeft % 60).padStart(2, "0");
  const low = p.timeLeft <= 30;

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
      <div
        className="h-1 bg-line"
        role="progressbar"
        aria-label="Time left"
        aria-valuemin={0}
        aria-valuemax={p.timeLimit}
        aria-valuenow={p.timeLeft}
      >
        <div
          className={`h-full transition-[width] duration-300 ease-linear ${low ? "bg-stop" : "bg-signal"}`}
          style={{ width: `${(p.timeLeft / p.timeLimit) * 100}%` }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-2.5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowExtract((v) => !v)}
            aria-expanded={showExtract}
            className="min-w-0 flex-1 rounded-xl bg-sun px-3.5 py-2 text-left text-sun-ink"
            title="Tap to see what the target is"
          >
            <div className="text-xs font-medium opacity-70">Get to</div>
            <div className="truncate text-lg font-bold leading-tight">{p.target}</div>
          </button>
          <div className="text-right">
            <div className="text-3xl font-extrabold leading-none tabular-nums">{p.clicks}</div>
            <div className="mt-0.5 text-xs text-muted">{p.clicks === 1 ? "click" : "clicks"}</div>
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-extrabold leading-none tabular-nums ${low ? "text-stop" : ""}`}
            >
              {mm}:{ss}
            </div>
            <div className="mt-0.5 text-xs text-muted">left</div>
          </div>
        </div>

        {showExtract && p.targetExtract && (
          <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted ring-1 ring-line">
            {p.targetExtract}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-3">
          <button
            onClick={p.onBack}
            disabled={!p.canGoBack || p.busy}
            className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium disabled:opacity-40"
            title="Going back costs a click"
          >
            Back (+1 click)
          </button>
          <Trail path={p.path} target={p.target} />
          <button
            onClick={p.onGiveUp}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-stop ring-1 ring-stop/40"
          >
            Give up
          </button>
        </div>
        {p.children}
      </div>
    </header>
  );
}

interface ArticleViewProps {
  title: string;
  html: string;
  busy: boolean;
  error: string | null;
  onLink: (title: string) => void;
}

/** The rendered Wikipedia article; link clicks are routed to onLink. */
export function ArticleView({ title, html, busy, error, onLink }: ArticleViewProps) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6" aria-busy={busy}>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-stop/10 px-3 py-2 text-sm text-stop">
          {error}
        </p>
      )}
      <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight">{title}</h1>
      <div
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest("a");
          if (!a) return;
          e.preventDefault();
          const linked = a.getAttribute("data-title");
          if (linked) onLink(linked);
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={`wiki-content transition-opacity ${busy ? "opacity-50" : ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
