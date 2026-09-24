"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { newerRun } from "@/components/room/progress";
import { Race } from "@/components/room/Race";
import { Lobby, Results, Waiting } from "@/components/room/views";
import { ApiError, apiCall } from "@/lib/client/api";
import { ensureIdentity, loadIdentity, type Identity } from "@/lib/client/identity";
import { realtime } from "@/lib/client/realtime";
import type { RoomState, RunStatus, RunView } from "@/lib/room-types";

const CLOSE_AFTER_MS = 2500; // past the time limit, so the server's grace has passed
const CLOSE_RETRY_MS = 5000;

type Phase = "loading" | "need-name" | "ready" | "error";

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** Merge a fresh state into ours without letting a slow response undo a newer move. */
function mergeState(prev: RoomState | null, next: RoomState): RoomState {
  if (!prev) return next;
  if (next.serverNow < prev.serverNow) return prev;
  if (prev.round?.id !== next.round?.id) return next;
  const old = new Map(prev.runs.map((r) => [r.playerId, r]));
  return {
    ...next,
    runs: next.runs.map((r) => {
      const o = old.get(r.playerId);
      return o ? newerRun(o, r) : r;
    }),
  };
}

/** Clock ticking in server time, so every player sees the same countdown. */
function useServerNow(offset: React.RefObject<number>): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset.current);
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [offset]);
  return now;
}

export default function Room({ code: rawCode }: { code: string }) {
  const code = rawCode.toUpperCase();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [state, setState] = useState<RoomState | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const offset = useRef(0);
  const now = useServerNow(offset);

  const apply = useCallback((s: RoomState) => {
    offset.current = s.serverNow - Date.now();
    setState((prev) => mergeState(prev, s));
  }, []);

  const join = useCallback(
    async (id: Identity) => {
      try {
        apply(await apiCall<RoomState>(`/api/rooms/${code}/join`, { name: id.name }));
        setIdentity(id);
        setPhase("ready");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setPhase("need-name"); // saved identity was stale and has been cleared
        } else {
          setFatal(message(e));
          setPhase("error");
        }
      }
    },
    [code, apply],
  );

  useEffect(() => {
    const id = loadIdentity();
    const t = setTimeout(() => (id ? join(id) : setPhase("need-name")), 0);
    return () => clearTimeout(t);
  }, [join]);

  // Refetch, coalescing bursts of "refresh" hints into at most one extra call.
  const inflight = useRef(false);
  const again = useRef(false);
  const refresh = useCallback(async () => {
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    try {
      do {
        again.current = false;
        try {
          apply(await apiCall<RoomState>(`/api/rooms/${code}`));
        } catch {
          // Transient; the next hint or poll will retry.
        }
      } while (again.current);
    } finally {
      inflight.current = false;
    }
  }, [code, apply]);

  const onProgress = useCallback(
    (p: { playerId: string; clicks: number; status: RunStatus }) => {
      let known = false;
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          runs: prev.runs.map((r) => {
            if (r.playerId !== p.playerId) return r;
            known = true;
            return newerRun(r, { ...r, clicks: p.clicks, status: p.status });
          }),
        };
      });
      if (!known) refresh();
    },
    [refresh],
  );

  // Realtime: broadcast hints from the server, presence for who's online.
  const meId = identity?.id;
  const meName = identity?.name;
  useEffect(() => {
    if (!meId) return;
    const ch = realtime().channel(`room:${code}`, { config: { presence: { key: meId } } });
    ch.on("broadcast", { event: "refresh" }, () => refresh())
      .on("broadcast", { event: "progress" }, ({ payload }) => onProgress(payload))
      .on("broadcast", { event: "rematch" }, ({ payload }) => {
        if (typeof payload?.code === "string") router.push(`/room/${payload.code}`);
      })
      .on("presence", { event: "sync" }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.track({ name: meName });
          refresh(); // catch anything sent before we were listening
        }
      });
    return () => {
      realtime().removeChannel(ch);
    };
  }, [code, meId, meName, refresh, onProgress, router]);

  // Polling fallback in case a broadcast is missed; faster while scoring.
  const roundStatus = state?.round?.status;
  useEffect(() => {
    if (phase !== "ready") return;
    const id = setInterval(refresh, roundStatus === "closing" ? 3000 : 10000);
    const onVis = () => !document.hidden && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase, roundStatus, refresh]);

  // Once time is up, nudge the server to close the round (any player may).
  const roundId = state?.round?.id;
  const endsAt = state?.round ? state.round.startsAt + state.round.timeLimit * 1000 : 0;
  useEffect(() => {
    if (!roundId || roundStatus === "closed") return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        apply(await apiCall<RoomState>(`/api/rooms/${code}/close`, {}));
      } catch {
        // retried below
      }
      timer = setTimeout(tick, CLOSE_RETRY_MS);
    };
    timer = setTimeout(tick, Math.max(0, endsAt + CLOSE_AFTER_MS - (Date.now() + offset.current)));
    return () => clearTimeout(timer);
  }, [code, roundId, roundStatus, endsAt, apply]);

  const onRun = useCallback((run: RunView) => {
    setState(
      (prev) =>
        prev && {
          ...prev,
          runs: prev.runs.map((r) => (r.playerId === run.playerId ? newerRun(r, run) : r)),
        },
    );
  }, []);

  async function hostAction(action: "start" | "rematch") {
    setBusy(true);
    setNotice(null);
    try {
      if (action === "start") {
        apply(await apiCall<RoomState>(`/api/rooms/${code}/start`, {}));
      } else {
        const next = await apiCall<{ code: string }>(`/api/rooms/${code}/rematch`, {});
        router.push(`/room/${next.code}`);
      }
    } catch (e) {
      setNotice(message(e));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 text-muted">
        Joining room {code}...
      </main>
    );
  }

  if (phase === "need-name") {
    return <NameGate code={code} onReady={join} />;
  }

  if (phase === "error" || !state) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-14">
        <h1 className="text-4xl font-extrabold tracking-tight">Can&apos;t open room {code}</h1>
        <p role="alert" className="mt-4 text-lg text-muted">
          {fatal ?? "Something went wrong."}
        </p>
        <Link href="/play" className="mt-8 font-semibold text-signal underline">
          Create or join another room
        </Link>
      </main>
    );
  }

  const round = state.round;
  if (!round) {
    return (
      <Lobby
        state={state}
        online={online}
        busy={busy}
        notice={notice}
        onStart={() => hostAction("start")}
      />
    );
  }
  if (round.status === "closed") {
    return (
      <Results
        state={state}
        busy={busy}
        notice={notice}
        onNext={() => hostAction("start")}
        onRematch={() => hostAction("rematch")}
      />
    );
  }
  const mine = state.runs.find((r) => r.playerId === state.me);
  if (mine && mine.status === "playing" && round.status === "playing") {
    return <Race key={round.id} state={state} run={mine} now={now} onRun={onRun} onStale={refresh} />;
  }
  return <Waiting state={state} now={now} />;
}

function NameGate({ code, onReady }: { code: string; onReady: (id: Identity) => Promise<void> }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onReady(await ensureIdentity(name.trim()));
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-14">
      <p className="text-sm font-medium text-muted">You&apos;re invited to room</p>
      <h1 className="mt-1 text-6xl font-extrabold tracking-[0.15em]">{code}</h1>
      <form onSubmit={submit} className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            autoComplete="nickname"
            disabled={saving}
            className="rounded-xl border-2 border-line bg-surface px-4 py-3 text-lg font-normal outline-none transition-colors focus:border-signal"
          />
        </label>
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="rounded-xl bg-signal px-7 py-3.5 text-lg font-bold text-signal-ink transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Joining..." : "Join"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-stop/10 px-3 py-2 text-sm text-stop">
          {error}
        </p>
      )}
    </main>
  );
}
