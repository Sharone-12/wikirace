"use client";

import { useState } from "react";
import { RouteMap } from "@/components/RouteLine";
import {
  nameOf,
  resultOrder,
  STATUS_TEXT,
  Standings,
  liveOrder,
} from "@/components/room/progress";
import type { RoomState, RunView } from "@/lib/room-types";
import { describeCloseness } from "@/lib/scoring";

const btn =
  "rounded-xl bg-signal px-7 py-3.5 text-lg font-bold text-signal-ink transition-transform active:scale-[0.98] disabled:opacity-50";

function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-4 rounded-lg bg-stop/10 px-3 py-2 text-sm text-stop">
      {text}
    </p>
  );
}

function hostName(state: RoomState) {
  return state.players.find((p) => p.id === state.room.hostId)?.name ?? "the host";
}

// ---------------------------------------------------------------- lobby

interface LobbyProps {
  state: RoomState;
  online: Set<string>;
  busy: boolean;
  notice: string | null;
  onStart: () => void;
}

export function Lobby({ state, online, busy, notice, onStart }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const isHost = state.me === state.room.hostId;
  const { code, roundsTotal, timeLimit } = state.room;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/room/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the code is on screen anyway.
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm font-medium text-muted">Room code</p>
      <div className="mt-1 flex flex-wrap items-center gap-4">
        <h1 className="text-6xl font-extrabold tracking-[0.15em] sm:text-7xl">{code}</h1>
        <button
          onClick={copyLink}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium"
        >
          {copied ? "Link copied" : "Copy invite link"}
        </button>
      </div>
      <p className="mt-4 text-muted">
        {roundsTotal} round{roundsTotal === 1 ? "" : "s"}, {timeLimit / 60} minute
        {timeLimit === 60 ? "" : "s"} each. Everyone starts on the same article.
      </p>

      <h2 className="mb-3 mt-10 text-xl font-bold">
        Players <span className="text-muted">({state.players.length})</span>
      </h2>
      <Standings state={state} online={online} />

      <div className="mt-10">
        {isHost ? (
          <button onClick={onStart} disabled={busy} className={btn}>
            {busy ? "Picking a route..." : "Start round 1"}
          </button>
        ) : (
          <p className="text-muted">Waiting for {hostName(state)} to start the race.</p>
        )}
        <Notice text={notice} />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- waiting

/** My run is over (or I'm watching) but others are still racing. */
export function Waiting({ state, now }: { state: RoomState; now: number }) {
  const round = state.round!;
  const mine = state.runs.find((r) => r.playerId === state.me);
  const closing = round.status === "closing";
  const left = Math.max(0, Math.ceil((round.startsAt + round.timeLimit * 1000 - now) / 1000));

  let headline = "You're watching this round.";
  let sub = "You joined mid-race. You'll play the next round.";
  if (mine?.status === "finished") {
    headline = "You made it.";
    sub = `${round.target} in ${mine.clicks} click${mine.clicks === 1 ? "" : "s"}${
      mine.elapsedMs != null ? ` and ${(mine.elapsedMs / 1000).toFixed(1)} seconds` : ""
    }.${mine.score != null ? ` ${mine.score} points.` : ""}`;
  } else if (mine?.status === "gave_up") {
    headline = "Stopped short.";
    sub = "You'll be scored on how close you got when the round ends.";
  } else if (mine) {
    headline = "Out of time.";
    sub = "You'll be scored on how close you got.";
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12" aria-live="polite">
      <h1 className="text-5xl font-extrabold leading-none tracking-tight">{headline}</h1>
      <p className="mt-4 text-lg text-muted">{sub}</p>
      <p className="mt-8 font-medium">
        {closing
          ? "Scoring the round..."
          : `Waiting for the others · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`}
      </p>
      <ul className="mt-4 divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
        {liveOrder(state.runs).map((r) => (
          <li key={r.playerId} className="flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1 truncate font-medium">{nameOf(state, r.playerId)}</span>
            <span className="text-sm text-muted">{STATUS_TEXT[r.status]}</span>
            <span className="w-20 text-right tabular-nums">
              {r.clicks} click{r.clicks === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}

// ---------------------------------------------------------------- results

function runSummary(run: RunView, target: string): string {
  if (run.status === "finished") {
    const secs = run.elapsedMs != null ? `, ${(run.elapsedMs / 1000).toFixed(1)}s` : "";
    return `${run.clicks} click${run.clicks === 1 ? "" : "s"}${secs}`;
  }
  const how = STATUS_TEXT[run.status];
  return run.closeness ? `${how}. ${describeCloseness(run.closeness, target)}` : how;
}

interface ResultsProps {
  state: RoomState;
  busy: boolean;
  notice: string | null;
  onNext: () => void;
  onRematch: () => void;
}

export function Results({ state, busy, notice, onNext, onRematch }: ResultsProps) {
  const round = state.round!;
  const isHost = state.me === state.room.hostId;
  const over = state.room.status === "finished" || round.number >= state.room.roundsTotal;
  const ranked = resultOrder(state.runs);
  const [open, setOpen] = useState<string | null>(state.me);
  const leader = [...state.players].sort((a, b) => b.total - a.total)[0];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p className="text-sm font-medium text-muted">
        Round {round.number} of {state.room.roundsTotal} · {round.start} → {round.target}
      </p>
      <h1 className="mt-2 text-5xl font-extrabold leading-none tracking-tight">
        {over && leader ? `${leader.id === state.me ? "You win" : `${leader.name} wins`}.` : "Round results"}
      </h1>

      <ol className="mt-8 space-y-3">
        {ranked.map((r, i) => {
          const expanded = open === r.playerId;
          return (
            <li key={r.playerId} className="rounded-2xl bg-surface ring-1 ring-line">
              <button
                onClick={() => setOpen(expanded ? null : r.playerId)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="w-6 text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nameOf(state, r.playerId)}</span>
                  <span className="block text-sm text-muted">{runSummary(r, round.target)}</span>
                </span>
                <span
                  className={`text-2xl font-extrabold tabular-nums ${r.status === "finished" ? "text-go" : ""}`}
                >
                  {r.score ?? 0}
                </span>
              </button>
              {expanded && (
                <div className="border-t border-line px-4 py-4">
                  {r.scoreParts && (
                    <ul className="mb-5 space-y-1 text-sm">
                      {r.scoreParts.map((p) => (
                        <li key={p.label} className="flex justify-between gap-6">
                          <span className="text-muted">{p.label}</span>
                          <span className="font-semibold tabular-nums">
                            {p.points < 0 ? `−${-p.points}` : `+${p.points}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <RouteMap
                    path={(r.path ?? []).map((s) => s.title)}
                    target={round.target}
                    won={r.status === "finished"}
                    distance={r.closeness?.distance ?? null}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <h2 className="mb-3 mt-10 text-xl font-bold">{over ? "Final standings" : "Standings"}</h2>
      <Standings state={state} />

      <div className="mt-10">
        {isHost ? (
          <button onClick={over ? onRematch : onNext} disabled={busy} className={btn}>
            {busy
              ? over
                ? "Setting up..."
                : "Picking a route..."
              : over
                ? "Rematch"
                : `Start round ${round.number + 1}`}
          </button>
        ) : (
          <p className="text-muted">
            {over
              ? `Waiting for ${hostName(state)} to start a rematch.`
              : `Waiting for ${hostName(state)} to start the next round.`}
          </p>
        )}
        <Notice text={notice} />
      </div>
    </main>
  );
}
