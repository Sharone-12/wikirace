"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LineDemo, RouteMap, Trail } from "@/components/RouteLine";
import { pickTarget } from "@/lib/targets";
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
  fetchArticle,
  fetchExtract,
  normTitle,
  pickStart,
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
  const [showExtract, setShowExtract] = useState(false);
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
      const t = pickTarget();
      const canon = await canonicalTitle(t);
      targetCanon.current = canon;
      const [start, extract] = await Promise.all([pickStart(canon), fetchExtract(canon)]);
      setTarget(canon);
      setTargetExtract(extract);
      setShowExtract(false);
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
      startMeasure.current = measureCloseness(start, canon).catch(() => null);
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

  function onContentClick(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    const title = a.getAttribute("data-title");
    if (title) goTo(title, false);
  }

  function goBack() {
    if (stack.length < 2) return;
    goTo(stack[stack.length - 2], true);
  }

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
        : measureCloseness(article, target);
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
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-14">
        <h1 className="text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl">
          Get from here to there, one link at a time.
        </h1>
        <p className="mt-6 max-w-[46ch] text-lg text-muted">
          You start on a random Wikipedia article. Reach the target using only the links on the
          page. You have {TIME_LIMIT / 60} minutes.
        </p>

        <LineDemo running={loading} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            startRound();
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              autoComplete="nickname"
              disabled={loading}
              className="rounded-xl border-2 border-line bg-surface px-4 py-3 text-lg font-normal outline-none transition-colors focus:border-signal"
            />
          </label>
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="rounded-xl bg-signal px-7 py-3.5 text-lg font-bold text-signal-ink transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "Finding your route..." : "Start racing"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-stop/10 px-3 py-2 text-sm text-stop">
            {error}
          </p>
        )}
        <p className="mt-8 text-sm text-muted">
          Going back costs a click. Fewer clicks and more time left score higher.
        </p>
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">
          {headline}
        </h1>
        <p className="mt-4 text-lg text-muted">
          {won
            ? `${target} in ${clicks} click${clicks === 1 ? "" : "s"} and ${elapsed.toFixed(1)} seconds.`
            : `The target was ${target}.`}
          {tabSwitches > 0 &&
            ` You left the tab ${tabSwitches} time${tabSwitches === 1 ? "" : "s"}.`}
        </p>

        <section
          className="mt-8 rounded-2xl bg-surface p-6 ring-1 ring-line"
          aria-live="polite"
        >
          {score ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-sm font-medium text-muted">Your score</div>
                <div
                  className={`text-7xl font-extrabold leading-none tabular-nums ${won ? "text-go" : ""}`}
                >
                  {score.total}
                </div>
                {closeness && !won && (
                  <p className="mt-3 max-w-[30ch] text-sm text-muted">
                    {describeCloseness(closeness, target)}
                  </p>
                )}
              </div>
              <ul className="min-w-56 space-y-1.5 text-sm">
                {score.parts.map((p) => (
                  <li key={p.label} className="flex justify-between gap-6">
                    <span className="text-muted">{p.label}</span>
                    <span className="font-semibold tabular-nums">
                      {p.points < 0 ? `−${-p.points}` : `+${p.points}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : closenessFailed ? (
            <p role="alert" className="text-sm text-stop">
              Couldn&apos;t work out how close you got because Wikipedia didn&apos;t respond.
            </p>
          ) : (
            <p className="text-muted">Working out how close you got...</p>
          )}
        </section>

        <h2 className="mb-5 mt-10 text-xl font-bold">Your route</h2>
        <RouteMap
          path={path}
          target={target}
          won={won}
          distance={closeness?.distance ?? null}
        />

        <button
          onClick={startRound}
          className="mt-10 rounded-xl bg-signal px-7 py-3.5 text-lg font-bold text-signal-ink transition-transform active:scale-[0.98]"
        >
          Play again
        </button>
      </main>
    );
  }

  const mm = Math.floor(timeLeft / 60);
  const ss = String(timeLeft % 60).padStart(2, "0");
  const low = timeLeft <= 30;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div
          className="h-1 bg-line"
          role="progressbar"
          aria-label="Time left"
          aria-valuemin={0}
          aria-valuemax={TIME_LIMIT}
          aria-valuenow={timeLeft}
        >
          <div
            className={`h-full transition-[width] duration-300 ease-linear ${low ? "bg-stop" : "bg-signal"}`}
            style={{ width: `${(timeLeft / TIME_LIMIT) * 100}%` }}
          />
        </div>

        <div className="mx-auto max-w-4xl px-4 py-2.5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowExtract((v) => !v)}
              aria-expanded={showExtract}
              className="min-w-0 flex-1 rounded-xl bg-sun px-3.5 py-2 text-left text-sun-ink"
              title="Tap to see what the target is"
            >
              <div className="text-xs font-medium opacity-70">Get to</div>
              <div className="truncate text-lg font-bold leading-tight">{target}</div>
            </button>
            <div className="text-right">
              <div className="text-3xl font-extrabold leading-none tabular-nums">{clicks}</div>
              <div className="mt-0.5 text-xs text-muted">{clicks === 1 ? "click" : "clicks"}</div>
            </div>
            <div className="text-right">
              <div
                className={`text-3xl font-extrabold leading-none tabular-nums ${low ? "text-stop" : ""}`}
              >
                {mm}:{ss}
              </div>
              <div className="mt-0.5 text-xs text-muted">left</div>
            </div>
          </div>

          {showExtract && targetExtract && (
            <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted ring-1 ring-line">
              {targetExtract}
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-3">
            <button
              onClick={goBack}
              disabled={stack.length < 2 || navigating}
              className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium disabled:opacity-40"
              title="Going back costs a click"
            >
              Back (+1 click)
            </button>
            <Trail path={path} target={target} />
            <button
              onClick={() => finish("gave-up")}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-stop ring-1 ring-stop/40"
            >
              Give up
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6" aria-busy={navigating}>
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-stop/10 px-3 py-2 text-sm text-stop">
            {error}
          </p>
        )}
        <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight">
          {article?.title}
        </h1>
        <div
          onClick={onContentClick}
          onContextMenu={(e) => e.preventDefault()}
          className={`wiki-content transition-opacity ${navigating ? "opacity-50" : ""}`}
          dangerouslySetInnerHTML={{ __html: article?.html ?? "" }}
        />
      </main>
    </div>
  );
}
