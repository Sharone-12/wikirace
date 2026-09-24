"use client";

import { useEffect, useRef } from "react";

// The game's visual idea: a path through Wikipedia is a transit line.
// Articles are stations, the target is the terminus.

/** Landing-page line. While a round loads, a dot runs along it. */
export function LineDemo({ running }: { running: boolean }) {
  return (
    <div className="relative my-10 h-8" aria-hidden="true">
      <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded bg-line" />
      <div className="absolute left-0 right-3 top-0 h-full">
        {[0, 34, 68].map((left) => (
          <span
            key={left}
            className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-4 border-signal bg-bg"
            style={{ left: `${left}%` }}
          />
        ))}
        {running && <span className="train" />}
      </div>
      <span className="absolute right-0 top-1/2 size-7 -translate-y-1/2 rounded-full border-4 border-ink bg-sun" />
    </div>
  );
}

/** Compact trail of the last few stations, shown in the game header. */
export function Trail({ path, target }: { path: string[]; target: string }) {
  const ref = useRef<HTMLOListElement>(null);
  const shown = path.slice(-4);
  const cut = path.length - shown.length;

  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth });
  }, [path]);

  return (
    <ol
      ref={ref}
      className="hide-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto"
      aria-label="Your route so far"
    >
      {cut > 0 && <li className="shrink-0 pr-2 text-xs text-muted">+{cut} earlier</li>}
      {shown.map((title, i) => {
        const current = i === shown.length - 1;
        return (
          <li key={`${cut + i}-${title}`} className="flex shrink-0 items-center">
            <span
              className={`mr-1.5 size-2.5 rounded-full ${
                current ? "bg-signal ring-4 ring-signal/25" : "border-2 border-signal bg-bg"
              }`}
            />
            <span
              className={`max-w-32 truncate text-xs ${current ? "font-semibold" : "text-muted"}`}
              title={title}
            >
              {title}
            </span>
            <span className="mx-2 h-0.5 w-4 shrink-0 rounded bg-line" />
          </li>
        );
      })}
      <li className="flex shrink-0 items-center">
        <span className="mr-1.5 size-3 rounded-full border-2 border-ink bg-sun" />
        <span className="max-w-32 truncate text-xs font-semibold" title={target}>
          {target}
        </span>
      </li>
    </ol>
  );
}

interface RouteMapProps {
  path: string[];
  target: string;
  won: boolean;
  /** For a DNF: how many clicks the last article was from the target (3 = further). */
  distance?: 1 | 2 | 3 | null;
}

/** Results-screen route: a vertical line with a station per article visited. */
export function RouteMap({ path, target, won, distance }: RouteMapProps) {
  const lastIdx = path.length - 1;
  const gap =
    distance === 1 ? "one click" : distance === 2 ? "two clicks" : distance === 3 ? "a few clicks" : null;

  return (
    <ol className="relative">
      {path.map((title, i) => {
        const first = i === 0;
        const last = i === lastIdx;
        const finishedHere = last && won;
        const stoppedHere = last && !won;
        return (
          <li key={`${i}-${title}`} className="relative flex gap-4 pb-5 last:pb-0">
            {/* solid line down to the next station */}
            {!last && <span className="absolute bottom-0 left-2 top-5 w-1 rounded bg-signal" />}
            <span
              className={`relative z-[1] mt-0.5 size-5 shrink-0 rounded-full border-4 ${
                finishedHere
                  ? "border-go bg-go"
                  : stoppedHere && !first
                    ? "border-stop bg-bg"
                    : first
                      ? "border-signal bg-signal"
                      : "border-signal bg-bg"
              }`}
            />
            <div className="min-w-0">
              <div className={`break-words ${finishedHere ? "text-lg font-bold" : "font-medium"}`}>
                {title}
              </div>
              {first && <div className="text-sm text-muted">Where you started</div>}
              {stoppedHere && !first && <div className="text-sm text-stop">Where you stopped</div>}
              {finishedHere && <div className="text-sm text-go">Target reached</div>}
            </div>
          </li>
        );
      })}
      {!won && (
        <li className="relative flex gap-4 pt-6">
          {/* dashed run to a target you didn't reach */}
          <span className="absolute left-2 top-0 h-6 border-l-4 border-dashed border-line" />
          <span className="relative z-[1] mt-0.5 size-5 shrink-0 rounded-full border-4 border-ink bg-sun" />
          <div className="min-w-0">
            <div className="break-words font-bold">{target}</div>
            <div className="text-sm text-muted">{gap ? `Target, ${gap} away` : "Target"}</div>
          </div>
        </li>
      )}
    </ol>
  );
}
