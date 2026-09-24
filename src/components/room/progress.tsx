import type { RoomState, RunStatus, RunView } from "@/lib/room-types";
import { compareResults } from "@/lib/scoring";

export function nameOf(state: RoomState, id: string): string {
  if (id === state.me) return "You";
  return state.players.find((p) => p.id === id)?.name ?? "Player";
}

export const STATUS_TEXT: Record<RunStatus, string> = {
  playing: "racing",
  finished: "made it",
  gave_up: "gave up",
  timed_out: "out of time",
};

/** Keep whichever copy of a run is further along; responses can arrive out of order. */
export function newerRun(prev: RunView, next: RunView): RunView {
  if (prev.clicks > next.clicks) return prev;
  if (prev.status !== "playing" && next.status === "playing") return prev;
  return next;
}

/** Live order while racing: finishers by time, then everyone else by clicks. */
export function liveOrder(runs: RunView[]): RunView[] {
  const rank = (r: RunView) => (r.status === "finished" ? 0 : r.status === "playing" ? 1 : 2);
  return [...runs].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.status === "finished" ? (a.elapsedMs ?? 0) - (b.elapsedMs ?? 0) : b.clicks - a.clicks),
  );
}

/** Final order once scores are in. */
export function resultOrder(runs: RunView[]): RunView[] {
  const key = (r: RunView) => ({
    score: r.score ?? 0,
    clicks: r.clicks,
    elapsed: (r.elapsedMs ?? Infinity) / 1000,
  });
  return [...runs].sort((a, b) => compareResults(key(a), key(b)));
}

/** One chip per racer: name, clicks, and how their run ended. */
export function ProgressChips({ state }: { state: RoomState }) {
  return (
    <ul className="mt-2.5 flex gap-2 overflow-x-auto pb-1 text-sm" aria-label="Race progress">
      {liveOrder(state.runs).map((r) => (
        <li
          key={r.playerId}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 ring-1 ${
            r.status === "finished"
              ? "bg-go/10 ring-go/40"
              : r.status === "playing"
                ? "bg-surface ring-line"
                : "opacity-60 ring-line"
          }`}
        >
          <span className="max-w-[10ch] truncate font-medium">{nameOf(state, r.playerId)}</span>
          <span className="tabular-nums text-muted">{r.clicks}</span>
          {r.status !== "playing" && <span className="text-xs text-muted">{STATUS_TEXT[r.status]}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Running totals across rounds, best first. */
export function Standings({ state, online }: { state: RoomState; online?: Set<string> }) {
  const players = [...state.players].sort((a, b) => b.total - a.total);
  return (
    <ol className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
      {players.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 px-4 py-3">
          <span className="w-6 text-sm font-bold tabular-nums text-muted">{i + 1}</span>
          {online && (
            <span
              className={`size-2.5 rounded-full ${online.has(p.id) ? "bg-go" : "bg-line"}`}
              title={online.has(p.id) ? "Online" : "Away"}
            />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">
            {p.name}
            {p.id === state.me && <span className="text-muted"> (you)</span>}
            {p.id === state.room.hostId && <span className="ml-2 text-xs text-muted">host</span>}
          </span>
          <span className="font-bold tabular-nums">{p.total}</span>
        </li>
      ))}
    </ol>
  );
}
