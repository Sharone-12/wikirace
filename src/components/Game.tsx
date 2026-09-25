"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/Brand";
import { ArticleView, RaceHeader } from "@/components/RaceHeader";
import { RouteMap, RouteTicker } from "@/components/RouteLine";
import { rememberRound, recentTitles } from "@/lib/client/recent";
import { pickRoute } from "@/lib/targets";
import {
  describeCloseness,
  measureCloseness,
  scoreDnf,
  scoreFinish,
  type Closeness,
  type ScoreBreakdown,
} from "@/lib/scoring";
import {
  canonicalTitle,
  closeDeps,
  fetchArticle,
  fetchExtract,
  normTitle,
  pickCuratedStart,
  prefetchArticle,
  type Article,
} from "@/lib/wiki";

const TIME_LIMIT = 180; // seconds

type Phase = "name" | "loading" | "playing" | "done";
type Outcome = "won" | "gave-up" | "timeout";

export default function Game() {
  const [phase, setPhase] = useState<Phase>("name");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [target, setTarget] = useState("");
  const [targetExtract, setTargetExtract] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [stack, setStack] = useState<string[]>([]); // for the in-app Back button
  const [path, setPath] = useState<string[]>([]); // every article visited, in order
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [navigating, setNavigating] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [closeness, setCloseness] = useState<Closeness | null>(null);
  const [closenessFailed, setClosenessFailed] = useState(false);
  const [startCloseness, setStartCloseness] = useState<Closeness | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  // The next round's route, picked early so its start page downloads while
  // the player is still on the landing or results screen.
  const nextRoute = useRef<ReturnType<typeof pickRoute> | null>(null);
  const startedAt = useRef(0);
  const targetCanon = useRef("");
  // Start closeness, measured in the background while the round is played.
  const startMeasure = useRef<Promise<Closeness | null>>(Promise.resolve(null));

  const finish = useCallback((result: Outcome) => {
    setElapsed(Math.min(TIME_LIMIT, (Date.now() - startedAt.current) / 1000));
    setOutcome(result);
    setPhase("done");
  }, []);

  async function startRound() {
    if (!name.trim()) return;
    setError(null);
    setPhase("loading");
    try {
      const route = nextRoute.current ?? pickRoute(recentTitles());
      nextRoute.current = null;
      // Pool titles are canonical already; the lookup is a safety net, so
      // everything runs side by side.
      const [canon, start, extract] = await Promise.all([
        canonicalTitle(route.target),
        pickCuratedStart(route.starts, route.target),
        fetchExtract(route.target),
      ]);
      targetCanon.current = canon;
      rememberRound(start.title, canon);
      setTarget(canon);
      setTargetExtract(extract);
      setArticle(start);
      setStack([start.title]);
      setPath([start.title]);
      setClicks(0);
      setTabSwitches(0);
      setTimeLeft(TIME_LIMIT);
      setOutcome(null);
      setCloseness(null);
      setClosenessFailed(false);
      setStartCloseness(null);
      startMeasure.current = measureCloseness(start, canon, closeDeps).catch(() => null);
      startedAt.current = Date.now();
      setPhase("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("name");
    }
  }

  const goTo = useCallback(
    async (title: string, isBack: boolean) => {
      if (navigating || phase !== "playing") return;
      setNavigating(true);
      setError(null);
      try {
        const next = await fetchArticle(title);
        setArticle(next);
        setClicks((c) => c + 1); // going back counts as a click too
        setPath((p) => [...p, next.title]);
        setStack((s) => (isBack ? s.slice(0, -1) : [...s, next.title]));
        if (normTitle(next.title) === normTitle(targetCanon.current)) finish("won");
      } catch {
        setError("Couldn't load that article. Pick another link.");
      } finally {
        setNavigating(false);
      }
    },
    [navigating, phase, finish],
  );

  function goBack() {
    if (stack.length < 2) return;
    goTo(stack[stack.length - 2], true);
  }

  // On the landing and results screens, line up the next round and start
  // downloading its likely start pages (the first batch pickCuratedStart tries).
  useEffect(() => {
    if (phase !== "name" && phase !== "done") return;
    const route = pickRoute(recentTitles());
    nextRoute.current = route;
    route.starts.slice(0, 3).forEach(prefetchArticle);
  }, [phase]);

  // Countdown, driven by wall clock so it can't drift.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const left = Math.max(0, TIME_LIMIT - Math.floor((Date.now() - startedAt.current) / 1000));
      setTimeLeft(left);
      if (left === 0) finish("timeout");
    }, 250);
    return () => clearInterval(id);
  }, [phase, finish]);

  // Log tab switches (a soft anti-cheat signal shown on the results screen).
  useEffect(() => {
    if (phase !== "playing") return;
    const onVis = () => {
      if (document.hidden) setTabSwitches((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [phase]);

  // Trap browser back/forward so it can't be used to dodge the click count.
  useEffect(() => {
    if (phase !== "playing") return;
    history.pushState(null, "", location.href);
    const onPop = () => history.pushState(null, "", location.href);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [phase]);

  useEffect(() => {
    if (article) window.scrollTo({ top: 0 });
  }, [article]);

  // On a DNF, measure how close the last article was to the target.
  useEffect(() => {
    if (phase !== "done" || outcome === "won" || !article) return;
    let cancelled = false;
    const startP = startMeasure.current;
    // Never left the start article: reuse the background measurement.
    const endP =
      normTitle(article.title) === normTitle(path[0] ?? "")
        ? startP.then((c) => c ?? Promise.reject(new Error("unmeasured")))
        : measureCloseness(article, target, closeDeps);
    Promise.all([endP, startP])
      .then(([end, start]) => {
        if (cancelled) return;
        setStartCloseness(start);
        setCloseness(end);
      })
      .catch(() => !cancelled && setClosenessFailed(true));
    return () => {
      cancelled = true;
    };
  }, [phase, outcome, article, target, path]);

  if (phase === "name" || phase === "loading") {
    const loading = phase === "loading";
    return (
      <main className="landing flex min-h-0 w-full flex-1 flex-col">
        <div className="px-5 pt-4 sm:px-8 sm:pt-5">
          <TopBar />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 text-center sm:px-8">
          <h1 className="display text-4xl sm:text-6xl">
            From here to there,
            <br />
            one link at a time.
          </h1>
          <p className="mt-4 max-w-[48ch] text-muted">
            Start on a random Wikipedia article. Reach the target using only its links, in{" "}
            {TIME_LIMIT / 60} minutes.
          </p>

          <div className="mt-10 flex w-full justify-center">
            <RouteTicker />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                setError("Pick a name to race under first.");
                nameRef.current?.focus();
                return;
              }
              startRound();
            }}
            className="mt-10 flex w-full max-w-md flex-col gap-3"
          >
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={20}
              autoComplete="nickname"
              disabled={loading}
              placeholder="Your name"
              aria-label="Your name"
              className="field text-center text-lg"
            />
            <div className="grid grid-cols-2 gap-3">
              <button type="submit" disabled={loading} className="btn-ink text-base">
                {loading ? "Loading..." : "Solo"}
              </button>
              <Link href="/play" className="btn-line py-3 text-base">
                Multiplayer
              </Link>
            </div>
          </form>
          <p role="alert" className="kicker mt-3 h-4 text-ink">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    const won = outcome === "won";
    let score: ScoreBreakdown | null = null;
    if (won) score = scoreFinish(clicks, TIME_LIMIT - elapsed);
    else if (closeness) score = scoreDnf(closeness, startCloseness);

    const headline = won ? `${name} made it.` : outcome === "gave-up" ? "Stopped short." : "Out of time.";
    return (
      <main className="results mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-8">
        <TopBar />
        <p className="kicker mt-10 text-muted">
          Solo race · {path[0]} → {target}
        </p>
        <h1 className="display mt-2 text-5xl sm:text-6xl" data-outcome={won ? "won" : "lost"}>
          {headline}
        </h1>
        <p className="mt-4 text-lg text-muted">
          {won
            ? `${target} in ${clicks} click${clicks === 1 ? "" : "s"} and ${elapsed.toFixed(1)} seconds.`
            : `The target was ${target}.`}
          {tabSwitches > 0 &&
            ` You left the tab ${tabSwitches} time${tabSwitches === 1 ? "" : "s"}.`}
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-live="polite">
          <div
            className={`frame flex min-h-28 flex-col justify-between p-4 ${
              score ? "bg-ink text-white" : "bg-surface"
            }`}
          >
            <span className="kicker">Your score</span>
            {score ? (
              <span className="text-5xl font-black leading-none tracking-tighter tabular-nums">
                {score.total}
              </span>
            ) : closenessFailed ? (
              <span role="alert" className="text-sm font-semibold">
                Couldn&apos;t measure it: Wikipedia didn&apos;t respond.
              </span>
            ) : (
              <span className="text-sm font-semibold text-muted">Working it out...</span>
            )}
            <span className="text-xs font-semibold opacity-75">{won ? "finished" : "by closeness"}</span>
          </div>
          <div className="frame flex min-h-28 flex-col justify-between bg-surface p-4">
            <span className="kicker">Clicks</span>
            <span className="text-5xl font-black leading-none tracking-tighter tabular-nums">{clicks}</span>
            <span className="text-xs font-semibold text-muted">back counts as one</span>
          </div>
          <div className="frame flex min-h-28 flex-col justify-between bg-surface p-4">
            <span className="kicker">Time</span>
            <span className="text-5xl font-black leading-none tracking-tighter tabular-nums">
              {Math.round(elapsed)}
              <span className="text-2xl">s</span>
            </span>
            <span className="text-xs font-semibold text-muted">of {TIME_LIMIT}s</span>
          </div>
        </section>

        {closeness && !won && (
          <p className="mt-5 border-l-[3px] border-ink pl-3.5 text-sm leading-relaxed text-muted">
            {describeCloseness(closeness, target)}
          </p>
        )}

        {score && (
          <section className="frame mt-5 overflow-hidden bg-surface">
            <div className="flex items-center gap-2.5 border-b-2 border-ink px-5 py-3.5">
              <span className="size-[11px] bg-ink" />
              <h2 className="display text-lg tracking-[0.06em]">Score breakdown</h2>
            </div>
            <ul className="px-5 py-2 text-sm">
              {score.parts.map((p) => (
                <li
                  key={p.label}
                  className="flex justify-between gap-6 border-b border-hair py-2 last:border-0"
                >
                  <span>{p.label}</span>
                  <span className="font-bold tabular-nums">
                    {p.points < 0 ? `−${-p.points}` : `+${p.points}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="frame mt-5 overflow-hidden bg-surface">
          <div className="flex items-center gap-2.5 border-b-2 border-ink px-5 py-3.5">
            <span className="size-[11px] bg-ink" />
            <h2 className="display text-lg tracking-[0.06em]">Your route</h2>
            <span className="kicker ml-auto text-muted">
              {path.length} stop{path.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="p-5">
            <RouteMap path={path} target={target} won={won} distance={closeness?.distance ?? null} />
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={startRound} className="btn-ink text-base">
            Play again →
          </button>
          <Link href="/play" className="btn-line px-5 py-3">
            Race your friends
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <RaceHeader
        target={target}
        targetExtract={targetExtract}
        clicks={clicks}
        timeLeft={timeLeft}
        timeLimit={TIME_LIMIT}
        path={path}
        canGoBack={stack.length > 1}
        busy={navigating}
        onBack={goBack}
        onGiveUp={() => finish("gave-up")}
      />
      <ArticleView
        title={article?.title ?? ""}
        html={article?.html ?? ""}
        busy={navigating}
        error={error}
        onLink={(title) => goTo(title, false)}
      />
    </div>
  );
}
