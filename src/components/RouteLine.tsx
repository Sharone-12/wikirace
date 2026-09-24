"use client";

import { useEffect, useRef } from "react";

// The game's visual idea: a path through Wikipedia is a trail.
// Articles are ink stations; the target is a flag-black square at the end.

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
      {cut > 0 && <li className="kicker shrink-0 pr-2 text-muted">+{cut} earlier</li>}
      {shown.map((title, i) => {
        const current = i === shown.length - 1;
        return (
          <li key={`${cut + i}-${title}`} className="flex shrink-0 items-center">
            <span
              className={`mr-1.5 size-2.5 rounded-full ${
                current ? "bg-ink ring-2 ring-ink ring-offset-2 ring-offset-bg" : "border-2 border-ink bg-bg"
              }`}
            />
            <span
              className={`max-w-32 truncate text-xs ${current ? "font-bold" : "font-medium text-muted"}`}
              title={title}
            >
              {title}
            </span>
            <span className="mx-2 h-[2px] w-4 shrink-0 rounded bg-ink/35" />
          </li>
        );
      })}
      <li className="flex shrink-0 items-center">
        <span className="mr-1.5 size-3 bg-ink" />
        <span className="max-w-32 truncate text-xs font-bold" title={target}>
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
            {!last && <span className="absolute bottom-0 left-[9px] top-5 w-[3px] rounded bg-ink" />}
            <span
              className={`relative z-[1] mt-0.5 size-5 shrink-0 border-[2.5px] border-ink ${
                finishedHere
                  ? "bg-ink"
                  : stoppedHere && !first
                    ? "rounded-full border-dashed bg-bg"
                    : first
                      ? "rounded-full bg-ink"
                      : "rounded-full bg-bg"
              }`}
            />
            <div className="min-w-0">
              <div className={`break-words ${finishedHere ? "text-lg font-extrabold" : "font-semibold"}`}>
                {title}
              </div>
              {first && <div className="kicker mt-0.5 text-muted">Where you started</div>}
              {stoppedHere && !first && <div className="kicker mt-0.5">Where you stopped</div>}
              {finishedHere && <div className="kicker mt-0.5">Target reached</div>}
            </div>
          </li>
        );
      })}
      {!won && (
        <li className="relative flex gap-4 pt-6">
          {/* dashed run to a target you didn't reach */}
          <span className="absolute left-[9px] top-0 h-6 border-l-[3px] border-dashed border-ink/40" />
          <span className="relative z-[1] mt-0.5 size-5 shrink-0 border-[2.5px] border-ink bg-bg" />
          <div className="min-w-0">
            <div className="break-words font-extrabold">{target}</div>
            <div className="kicker mt-0.5 text-muted">{gap ? `Target, ${gap} away` : "Target"}</div>
          </div>
        </li>
      )}
    </ol>
  );
}
