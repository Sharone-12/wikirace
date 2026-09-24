"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleView, RaceHeader } from "@/components/RaceHeader";
import { ProgressChips } from "@/components/room/progress";
import { RoomShell } from "@/components/room/views";
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
  const [pageArrived, setPageArrived] = useState(false); // new page on screen while the server still checks
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
    setPageArrived(false);
    setError(null);
    const shownBefore = article;
    let failed = false;
    try {
      // Load the page while the server checks the click, and show it the
      // moment it's here rather than waiting for the server's answer.
      const page = "via" in body ? fetchArticle(body.via).catch(() => null) : null;
      page?.then((p) => {
        if (p && !failed) {
          setArticle(p);
          setPageArrived(true);
        }
      });
      const next = await apiCall<RunView>(`/api/rooms/${code}/move`, { from: run.current, ...body });
      const shown = (await page) ?? (next.current ? await fetchArticle(next.current) : null);
      requested.current = next.current;
      if (shown) setArticle(shown);
      onRun(next);
    } catch (e) {
      // The server said no: put back the page the player was actually on.
      failed = true;
      setPageArrived(false);
      if (shownBefore) setArticle(shownBefore);
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
      <RoomShell code={code}>
        <div className="flex flex-col items-center py-12 text-center">
          <p className="kicker text-muted">
            Round {round.number} of {state.room.roundsTotal} · get ready
          </p>
          <div className="mt-8 grid w-full gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="frame bg-surface p-4 text-left">
              <div className="kicker text-muted">Start</div>
              <div className="display mt-1 text-2xl">{round.start}</div>
            </div>
            <span className="text-2xl font-black" aria-hidden="true">
              →
            </span>
            <div className="frame bg-ink p-4 text-left text-white">
              <div className="kicker">Get to</div>
              <div className="display mt-1 text-2xl">{round.target}</div>
            </div>
          </div>
          {round.targetExtract && (
            <p className="mt-5 max-w-[56ch] border-l-[3px] border-ink pl-3.5 text-left text-sm leading-relaxed text-muted">
              {round.targetExtract}
            </p>
          )}
          <div
            className="frame mt-10 grid size-40 place-items-center rounded-full bg-ink font-condensed text-8xl font-semibold tabular-nums text-white"
            role="timer"
            aria-live="assertive"
          >
            {countdown}
          </div>
        </div>
      </RoomShell>
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
        busy={(navigating && !pageArrived) || locked}
        error={timeLeft === 0 ? "Time's up. Scoring the round..." : error}
        onLink={(title) => move({ via: title })}
      />
    </div>
  );
}
