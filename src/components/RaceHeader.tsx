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
    <header className="sticky top-0 z-10 border-b-[3px] border-ink bg-bg">
      <div
        className="h-2 border-b-2 border-ink bg-bg"
        role="progressbar"
        aria-label="Time left"
        aria-valuemin={0}
        aria-valuemax={p.timeLimit}
        aria-valuenow={p.timeLeft}
      >
        <div
          className={`h-full transition-[width] duration-300 ease-linear ${low ? "bar-low" : "bg-ink"}`}
          style={{ width: `${(p.timeLeft / p.timeLimit) * 100}%` }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-2.5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowExtract((v) => !v)}
            aria-expanded={showExtract}
            className="frame lift min-w-0 flex-1 bg-ink px-3.5 py-2 text-left text-white"
            title="Tap to see what the target is"
          >
            <div className="kicker">Get to ↗</div>
            <div className="display truncate text-2xl">{p.target}</div>
          </button>
          <div className="text-right">
            <div className="font-condensed text-[34px] font-semibold leading-none tabular-nums">{p.clicks}</div>
            <div className="kicker mt-1 text-muted">{p.clicks === 1 ? "click" : "clicks"}</div>
          </div>
          <div className="text-right">
            <div
              className={`font-condensed text-[34px] font-semibold leading-none tabular-nums ${low ? "bg-ink px-1.5 text-white" : ""}`}
            >
              {mm}:{ss}
            </div>
            <div className="kicker mt-1 text-muted">left</div>
          </div>
        </div>

        {showExtract && p.targetExtract && (
          <p className="frame mt-2 bg-surface px-3.5 py-2.5 text-sm leading-relaxed">
            {p.targetExtract}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-3">
          <button
            onClick={p.onBack}
            disabled={!p.canGoBack || p.busy}
            className="btn-line shrink-0 text-sm"
            title="Going back costs a click"
          >
            Back (+1 click)
          </button>
          <Trail path={p.path} target={p.target} />
          <button
            onClick={p.onGiveUp}
            className="btn-line shrink-0 text-sm"
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
        <p role="alert" className="frame mb-4 bg-stop px-3.5 py-2.5 text-sm font-semibold text-white">
          {error}
        </p>
      )}
      <h1 className="display mb-6 text-4xl sm:text-5xl">{title}</h1>
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
