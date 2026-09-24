"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleView, RaceHeader } from "@/components/RaceHeader";
import { ProgressChips } from "@/components/room/progress";
import { ApiError, apiCall } from "@/lib/client/api";
import type { RoomState, RunView } from "@/lib/room-types";
import { fetchArticle, type Article } from "@/lib/wiki";

interface RaceProps {
  state: RoomState;
  run: RunView; // my run, still playing
  now: number; // server clock, ms
  onRun: (run: RunView) => void;
  onStale: () => void; // our copy of the state is out of date: refetch
}

/** My race in a room. Every move is checked and timed by the server. */
export function Race({ state, run, now, onRun, onStale }: RaceProps) {
  const round = state.round!;
  const code = state.room.code;
  const [article, setArticle] = useState<Article | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef<string | null>(null);

  const countdown = Math.ceil((round.startsAt - now) / 1000);
  const timeLeft = Math.max(
    0,
    Math.min(round.timeLimit, Math.ceil((round.startsAt + round.timeLimit * 1000 - now) / 1000)),
  );
  const locked = countdown > 0 || timeLeft === 0;

  // Show the article the server says we're on (first load, or after a refetch).
  const current = run.current;
  useEffect(() => {
    const title = current;
    if (!title || requested.current === title) return;
    requested.current = title;
    let cancelled = false;
    fetchArticle(title)
      .then((a) => !cancelled && setArticle(a))
      .catch(() => !cancelled && setError("Couldn't load the article. Refresh to try again."));
    return () => {
      cancelled = true;
      requested.current = null;
    };
  }, [current]);

  async function move(body: { via: string } | { back: true }) {
    if (navigating || locked || !run.current) return;
    setNavigating(true);
    setError(null);
    try {
      // Load the page while the server checks the click.
      const page = "via" in body ? fetchArticle(body.via).catch(() => null) : null;
      const next = await apiCall<RunView>(`/api/rooms/${code}/move`, { from: run.current, ...body });
      const shown = (await page) ?? (next.current ? await fetchArticle(next.current) : null);
      requested.current = next.current;
      if (shown) setArticle(shown);
      onRun(next);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load that article. Pick another link.");
      onStale();
    } finally {
      setNavigating(false);
    }
  }

  async function giveUp() {
    try {
      onRun(await apiCall<RunView>(`/api/rooms/${code}/give-up`, {}));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reach the server.");
      onStale();
    }
  }

  // Trap browser back/forward so it can't be used to dodge the click count.
  useEffect(() => {
    history.pushState(null, "", location.href);
    const onPop = () => history.pushState(null, "", location.href);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (article) window.scrollTo({ top: 0 });
  }, [article]);

  if (countdown > 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-14 text-center">
        <p className="text-sm font-medium text-muted">
          Round {round.number} of {state.room.roundsTotal}
        </p>
        <div className="mx-auto mt-4 rounded-2xl bg-sun px-6 py-4 text-sun-ink">
          <div className="text-sm font-medium opacity-70">Get to</div>
          <div className="text-3xl font-extrabold leading-tight">{round.target}</div>
        </div>
        {round.targetExtract && (
          <p className="mx-auto mt-4 max-w-[52ch] text-muted">{round.targetExtract}</p>
        )}
        <p className="mt-6 text-muted">Starting from {round.start}</p>
        <div
          className="mt-8 text-8xl font-extrabold tabular-nums"
          role="timer"
          aria-live="assertive"
        >
          {countdown}
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <RaceHeader
        target={round.target}
        targetExtract={round.targetExtract}
        clicks={run.clicks}
        timeLeft={timeLeft}
        timeLimit={round.timeLimit}
        path={(run.path ?? []).map((s) => s.title)}
        canGoBack={run.canGoBack}
        busy={navigating || locked}
        onBack={() => move({ back: true })}
        onGiveUp={giveUp}
      >
        <ProgressChips state={state} />
      </RaceHeader>
      <ArticleView
        title={article?.title ?? run.current ?? ""}
        html={article?.html ?? ""}
        busy={navigating || locked}
        error={timeLeft === 0 ? "Time's up. Scoring the round..." : error}
        onLink={(title) => move({ via: title })}
      />
    </div>
  );
}
