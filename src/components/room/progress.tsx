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

/** Fill for a run's outcome, used on tags and chips: ink for made it, dashed for didn't. */
export const STATUS_FILL: Record<RunStatus, string> = {
  playing: "bg-surface",
  finished: "bg-ink text-white",
  gave_up: "bg-bg text-muted border-dashed",
  timed_out: "bg-bg text-muted border-dashed",
};

/** Small uppercase pill naming how a run is going or ended. */
export function StatusTag({ status }: { status: RunStatus }) {
  return (
    <span className={`kicker frame shrink-0 px-2 py-0.5 text-[9.5px] ${STATUS_FILL[status]}`}>
      {STATUS_TEXT[status]}
    </span>
  );
}

/** A framed panel with a header row: ink square, condensed title, uppercase note. */
export function Panel({
  title,
  note,
  color = "bg-ink",
  children,
}: {
  title: string;
  note?: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="frame overflow-hidden bg-surface">
      <div className="flex items-center gap-2.5 border-b-2 border-ink px-5 py-3.5">
        <span className={`size-[11px] shrink-0 ${color}`} />
        <h2 className="display text-lg tracking-[0.06em]">{title}</h2>
        {note && <span className="kicker ml-auto text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** One chip per racer: name, clicks, and how their run ended. */
export function ProgressChips({ state }: { state: RoomState }) {
  return (
    <ul className="hide-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-0.5 text-sm" aria-label="Race progress">
      {liveOrder(state.runs).map((r) => (
        <li
          key={r.playerId}
          className={`frame flex shrink-0 items-center gap-2 rounded-full py-1 pl-3 pr-2.5 ${STATUS_FILL[r.status]}`}
        >
          <span className="max-w-[10ch] truncate font-bold">{nameOf(state, r.playerId)}</span>
          <span className="font-black tabular-nums">{r.clicks}</span>
          {r.status !== "playing" && <span className="kicker text-[9.5px]">{STATUS_TEXT[r.status]}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Running totals across rounds, best first. */
export function Standings({
  state,
  online,
  title = "Standings",
}: {
  state: RoomState;
  online?: Set<string>;
  title?: string;
}) {
  const players = [...state.players].sort((a, b) => b.total - a.total);
  const here = online ? players.filter((p) => online.has(p.id)).length : null;
  return (
    <Panel
      title={title}
      color="bg-ink"
      note={here !== null ? `${here} online` : `${players.length} player${players.length === 1 ? "" : "s"}`}
    >
      <ol>
        {players.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 border-b border-hair px-5 py-3 last:border-0">
            <span className="kicker w-6 tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
            {online && (
              <span
                className={`size-2.5 shrink-0 rounded-full border-2 border-ink ${online.has(p.id) ? "bg-ink" : "bg-bg"}`}
                title={online.has(p.id) ? "Online" : "Away"}
              />
            )}
            <span className="min-w-0 flex-1 truncate font-bold">
              {p.name}
              {p.id === state.me && <span className="font-medium text-muted"> (you)</span>}
            </span>
            {p.id === state.room.hostId && (
              <span className="kicker frame bg-ink px-2 py-0.5 text-[9.5px] text-white">host</span>
            )}
            <span className="w-14 text-right text-lg font-black tabular-nums tracking-tight">{p.total}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
