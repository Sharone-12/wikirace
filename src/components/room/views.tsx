"use client";

import { useState } from "react";
import { TopBar } from "@/components/Brand";
import { RouteMap } from "@/components/RouteLine";
import {
  liveOrder,
  nameOf,
  Panel,
  resultOrder,
  Standings,
  STATUS_TEXT,
  StatusTag,
} from "@/components/room/progress";
import type { RoomState, RunView } from "@/lib/room-types";

function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="frame mt-3 bg-stop px-3.5 py-2.5 text-sm font-semibold text-white">
      {text}
    </p>
  );
}

function hostName(state: RoomState) {
  return state.players.find((p) => p.id === state.room.hostId)?.name ?? "the host";
}

/** Page frame shared by the room screens: brand on the left, room code on the right. */
export function RoomShell({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-8">
      <TopBar
        tagline="multiplayer race"
        right={<span className="kicker frame bg-ink px-3 py-1.5 tracking-[0.2em] text-white">Room {code}</span>}
      />
      {children}
    </main>
  );
}

/** Big number block. */
function Stat({ k, v, u, color }: { k: string; v: string | number; u: string; color: string }) {
  return (
    <div className={`frame flex min-h-24 flex-col justify-between px-4 pb-3.5 pt-3 ${color}`}>
      <span className="kicker">{k}</span>
      <span className="font-condensed text-[36px] font-semibold leading-none tabular-nums">{v}</span>
      <span className="text-[11px] font-semibold opacity-75">{u}</span>
    </div>
  );
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
    <RoomShell code={code}>
      <p className="kicker mt-10 text-muted">Room code · share it or send the link</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex gap-2" aria-label={`Room code ${code.split("").join(" ")}`}>
          {code.split("").map((ch, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="frame grid h-20 w-16 place-items-center bg-surface font-condensed text-5xl font-semibold sm:h-24 sm:w-20 sm:text-6xl"
            >
              {ch}
            </span>
          ))}
        </div>
        <button onClick={copyLink} className="btn-line px-4 py-2.5 text-sm">
          {copied ? "Link copied ✓" : "Copy invite link ↗"}
        </button>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <Stat k="Rounds" v={roundsTotal} u="then a winner" color="bg-ink text-white" />
        <Stat k="Minutes" v={timeLimit / 60} u="per round" color="bg-surface" />
        <Stat k="Players" v={state.players.length} u="in the room" color="bg-surface" />
      </div>

      <div className="mt-5">
        <Standings state={state} online={online} title="Players" />
      </div>

      <div className="mt-8">
        {isHost ? (
          <button onClick={onStart} disabled={busy} className="btn-ink text-base">
            {busy ? "Picking a route..." : "Start round 1 →"}
          </button>
        ) : (
          <p className="border-l-[3px] border-ink pl-3.5 text-muted">
            Waiting for <b className="text-ink">{hostName(state)}</b> to start the race.
          </p>
        )}
        <Notice text={notice} />
      </div>
    </RoomShell>
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
    <RoomShell code={state.room.code}>
      <p className="kicker mt-10 text-muted">
        Round {round.number} of {state.room.roundsTotal} · {round.start} → {round.target}
      </p>
      <h1 className="display mt-2 text-5xl sm:text-6xl" aria-live="polite">
        {headline}
      </h1>
      <p className="mt-4 text-lg text-muted">{sub}</p>

      <div className="mt-8">
        <Panel
          title={closing ? "Scoring the round" : "Race progress"}
          color="bg-ink"
          note={closing ? "measuring routes..." : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`}
        >
          <ul>
            {liveOrder(state.runs).map((r) => (
              <li key={r.playerId} className="flex items-center gap-3 border-b border-hair px-5 py-3 last:border-0">
                <span className="min-w-0 flex-1 truncate font-bold">{nameOf(state, r.playerId)}</span>
                <StatusTag status={r.status} />
                <span className="w-20 text-right font-black tabular-nums">
                  {r.clicks} <span className="kicker font-bold text-muted">click{r.clicks === 1 ? "" : "s"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </RoomShell>
  );
}

// ---------------------------------------------------------------- results

function runSummary(run: RunView, target: string): string {
  if (run.status === "finished") {
    const secs = run.elapsedMs != null ? ` in ${(run.elapsedMs / 1000).toFixed(1)}s` : "";
    return `${run.clicks} click${run.clicks === 1 ? "" : "s"}${secs}`;
  }
  // Neutral wording: this line is shown for every player, not just you.
  const d = run.closeness?.distance;
  if (d === 1) return `Stopped one click from ${target}`;
  if (d === 2) return `Stopped two clicks from ${target}`;
  if (d === 3) return `Stopped a few clicks from ${target}`;
  return STATUS_TEXT[run.status];
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
  const iWon = leader?.id === state.me;

  return (
    <RoomShell code={state.room.code}>
      <p className="kicker mt-10 text-muted">
        Round {round.number} of {state.room.roundsTotal} · {round.start} → {round.target}
      </p>
      <h1 className="display mt-2 text-5xl sm:text-6xl">{over ? "Game over." : "Round results."}</h1>

      {over && leader && (
        <div className="frame mt-6 flex flex-wrap items-end justify-between gap-4 bg-ink p-5 text-white">
          <div>
            <div className="kicker opacity-90">Winner</div>
            <div className="display mt-1 text-5xl">
              {iWon ? "You" : leader.name}
            </div>
          </div>
          <div className="text-right">
            <div className="font-condensed text-[46px] font-semibold leading-none tabular-nums">{leader.total}</div>
            <div className="kicker opacity-90">points</div>
          </div>
        </div>
      )}

      <ol className="mt-6 space-y-3">
        {ranked.map((r, i) => {
          const expanded = open === r.playerId;
          return (
            <li key={r.playerId} className="frame overflow-hidden bg-surface">
              <button
                onClick={() => setOpen(expanded ? null : r.playerId)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-bg"
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-black ${
                    i === 0 ? "bg-ink text-white" : "frame bg-bg"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="display truncate text-xl">{nameOf(state, r.playerId)}</span>
                    <StatusTag status={r.status} />
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{runSummary(r, round.target)}</span>
                </span>
                <span className="text-right">
                  <span className="block font-condensed text-3xl font-semibold leading-none tabular-nums">
                    {r.score ?? 0}
                  </span>
                  <span className="kicker text-muted">pts {expanded ? "▴" : "▾"}</span>
                </span>
              </button>
              {expanded && (
                <div className="grid gap-5 border-t-2 border-ink bg-bg px-4 py-4 sm:grid-cols-[1fr_1.2fr]">
                  {r.scoreParts && (
                    <ul className="text-sm">
                      {r.scoreParts.map((p) => (
                        <li key={p.label} className="flex justify-between gap-4 border-b border-hair py-1.5 last:border-0">
                          <span>{p.label}</span>
                          <span className="font-bold tabular-nums">
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

      <div className="mt-5">
        <Standings state={state} title={over ? "Final standings" : "Standings"} />
      </div>

      <div className="mt-8">
        {isHost ? (
          <button onClick={over ? onRematch : onNext} disabled={busy} className="btn-ink text-base">
            {busy
              ? over
                ? "Setting up..."
                : "Picking a route..."
              : over
                ? "Rematch →"
                : `Start round ${round.number + 1} →`}
          </button>
        ) : (
          <p className="border-l-[3px] border-ink pl-3.5 text-muted">
            Waiting for <b className="text-ink">{hostName(state)}</b> to start{" "}
            {over ? "a rematch" : "the next round"}.
          </p>
        )}
        <Notice text={notice} />
      </div>
    </RoomShell>
  );
}
