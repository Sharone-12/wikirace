"use client";

import { useEffect, useRef, useState } from "react";

// The game's visual idea: a path through Wikipedia is a trail.
// Articles are ink stations; the target is a flag-black square at the end.

// Example races for the landing animation: each one is a plausible chain of links.
const EXAMPLES = [
  ["Coffee", "Ethiopia", "Africa", "Earth"],
  ["Pizza", "Italy", "Europe", "World War II"],
  ["Guitar", "Spain", "Football", "Brazil"],
  ["Honey", "Bee", "Insect", "Dinosaur"],
];
const TICK_MS = 480;

/**
 * Landing animation: a cursor glides to the next article, clicks it, and the
 * dot hops there, one link at a time, until it reaches the target. Then the
 * next example race begins.
 */
export function RouteTicker() {
  const [race, setRace] = useState(0);
  // Two ticks per hop: odd ticks move the cursor to the next stop, even ticks click it.
  const [t, setT] = useState(0);
  const stops = EXAMPLES[race];
  const last = stops.length - 1;
  const end = last * 2;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setT(end), 0);
      return () => clearTimeout(id);
    }
    const id = setInterval(() => {
      setT((n) => {
        if (n < end + 3) return n + 1;
        setRace((r) => (r + 1) % EXAMPLES.length);
        return 0;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [end]);

  const at = Math.min(Math.floor(t / 2), last);
  const aim = Math.min(Math.ceil(t / 2), last); // where the cursor is
  const clicking = t > 0 && t <= end && t % 2 === 0;
  const done = at === last;
  const pct = (i: number) => `${(i / last) * 100}%`;

  return (
    <div className="w-full max-w-xl" aria-hidden="true">
      <div className="relative mx-10 h-6">
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-hair" />
        <div
          className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 bg-ink transition-[width] duration-500 ease-out"
          style={{ width: pct(at) }}
        />
        {stops.map((_, i) => (
          <span
            key={i}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-ink transition-colors duration-300 ${
              i === last ? "size-4" : "size-3 rounded-full"
            } ${i <= at ? "bg-ink" : "bg-bg"}`}
            style={{ left: pct(i) }}
          />
        ))}
        <span
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-4 ring-bg transition-[left] duration-500 ease-out"
          style={{ left: pct(at) }}
        />
        {clicking && (
          <span
            key={`ripple-${race}-${t}`}
            className="click-ripple absolute top-1/2 size-5 rounded-full border-2 border-ink"
            style={{ left: pct(at) }}
          />
        )}
        {/* cursor: its arrow tip sits on the stop it's aiming at */}
        <span
          className="absolute top-1/2 z-10 transition-[left] duration-300 ease-in-out"
          style={{ left: pct(aim), marginLeft: 3, marginTop: 3 }}
        >
          <svg
            key={clicking ? `press-${race}-${t}` : "idle"}
            width="32"
            height="32"
            viewBox="0 0 24 24"
            className={clicking ? "click-press" : undefined}
          >
            <path
              d="M2 2 V19 L6.2 15.2 L9.2 21.6 L12.2 20.2 L9.2 13.9 L15 13.6 Z"
              fill="var(--ink)"
              stroke="var(--bg)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <div className="relative mx-10 mt-3 h-5">
        {stops.map((title, i) => (
          <span
            key={`${race}-${title}`}
            className={`absolute -translate-x-1/2 whitespace-nowrap text-sm transition-opacity duration-500 ${
              i === 0 || i === last ? "font-bold" : "text-muted"
            } ${i === 0 || i === last || i <= at ? "opacity-100" : "opacity-0"}`}
            style={{ left: pct(i) }}
          >
            {title}
          </span>
        ))}
      </div>
      <p className="kicker mt-4 text-center text-muted">
        {done ? `Made it in ${last} clicks` : `${at} click${at === 1 ? "" : "s"}`}
      </p>
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
