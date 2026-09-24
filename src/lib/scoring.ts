// Pure scoring logic, shared by the browser (solo mode) and the server
// (multiplayer). Network access comes in through CloseDeps.
import { normTitle, type Article } from "@/lib/wiki-core";

// How close a player got, measured from the last article they were on.
//   1 = that article links straight to the target (one click away)
//   2 = one of its links links to the target (two clicks away)
//   3 = further than we can cheaply measure
//
// Everything is judged by links the player could actually click, meaning the
// rendered article (navboxes, hatnotes and reference sections are stripped),
// not by everything the Wikipedia API knows about.
export interface Closeness {
  distance: 1 | 2 | 3;
  // Distance 2: how many neighbouring articles (up to MAX_ROUTES) confirmed to
  // link to the target from their rendered page.
  routes: number;
  // Distance 3: shared-links similarity with the target, 0..1 (cosine).
  overlap: number;
}

type LinkedArticle = Pick<Article, "title" | "links">;

export interface CloseDeps {
  aliases(target: string): Promise<string[]>;
  linkersOf(titles: string[], targets: string[]): Promise<string[]>;
  getArticle(title: string): Promise<LinkedArticle>;
}

export const MAX_ROUTES = 10; // more routes than this earns nothing extra
export const MAX_VERIFY = 20; // rendered pages fetched to confirm candidates
const VERIFY_PARALLEL = 4;

export async function measureCloseness(
  article: LinkedArticle,
  target: string,
  deps: CloseDeps,
): Promise<Closeness> {
  // Aliases are a refinement, so a failed lookup degrades instead of failing.
  const aliases = await deps.aliases(target).catch(() => [] as string[]);
  const targets = [normTitle(target), ...aliases];
  const targetSet = new Set(targets);
  const hitsTarget = (links: string[]) => links.some((l) => targetSet.has(normTitle(l)));

  // Distance 1: judged on the rendered page's own links.
  if (hitsTarget(article.links)) return { distance: 1, routes: 1, overlap: 0 };

  // Distance 2: API prefilter, then confirm each candidate against its
  // rendered page so links the player couldn't click don't count.
  const candidates = (await deps.linkersOf(article.links, targets))
    .map(normTitle)
    .filter((c) => c !== normTitle(article.title))
    .slice(0, MAX_VERIFY);
  let routes = 0;
  for (let i = 0; i < candidates.length && routes < MAX_ROUTES; i += VERIFY_PARALLEL) {
    const checked = await Promise.all(
      candidates.slice(i, i + VERIFY_PARALLEL).map((c) =>
        deps
          .getArticle(c)
          .then((a) => hitsTarget(a.links))
          .catch(() => false),
      ),
    );
    routes += checked.filter(Boolean).length;
  }
  if (routes > 0) return { distance: 2, routes: Math.min(routes, MAX_ROUTES), overlap: 0 };

  // Distance 3+: no route found, so grade by how much of the article's
  // neighbourhood it shares with the target's (cosine over link sets).
  const overlap = await deps
    .getArticle(target)
    .then((t) => cosine(article.links, t.links))
    .catch(() => 0);
  return { distance: 3, routes: 0, overlap };
}

function cosine(a: string[], b: string[]): number {
  const A = new Set(a.map(normTitle));
  const B = new Set(b.map(normTitle));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared++;
  return shared / Math.sqrt(A.size * B.size);
}

export const FINISH_BASE = 1000; // any finish outranks any DNF (DNF max is 500)

export interface ScoreBreakdown {
  total: number;
  parts: { label: string; points: number }[];
}

export function scoreFinish(clicks: number, timeLeftSeconds: number): ScoreBreakdown {
  const time = Math.max(0, Math.round(timeLeftSeconds)) * 2; // up to 360
  const efficiency = Math.max(0, 200 - clicks * 10); // up to 200
  return {
    total: FINISH_BASE + time + efficiency,
    parts: [
      { label: "Reached the target", points: FINISH_BASE },
      { label: "Time left", points: time },
      { label: "Few clicks", points: efficiency },
    ],
  };
}

// How close a position is, as points (higher = closer). Max 500, so no DNF
// can reach FINISH_BASE.
export function closenessPoints(c: Closeness): { points: number; label: string } {
  if (c.distance === 1) return { points: 500, label: "one click away" };
  if (c.distance === 2) {
    const bonus = Math.min(150, c.routes * 15); // more routes = closer
    return {
      points: 250 + bonus,
      label: `two clicks away (${c.routes} route${c.routes === 1 ? "" : "s"})`,
    };
  }
  // Far away: 20..80 by topic overlap, so far-away positions still differ.
  return { points: 20 + Math.round(60 * Math.min(1, c.overlap * 6)), label: "a few clicks away" };
}

// A DNF scores the progress made: how much closer you ended than you started.
// Giving up at the start, or wandering further away, scores 0. If the start
// couldn't be measured, falls back to where you ended.
export function scoreDnf(end: Closeness, start: Closeness | null): ScoreBreakdown {
  const e = closenessPoints(end);
  if (!start) {
    return { total: e.points, parts: [{ label: `Ended ${e.label}`, points: e.points }] };
  }
  const s = closenessPoints(start);
  const gain = e.points - s.points;
  if (gain <= 0) {
    return { total: 0, parts: [{ label: "No closer than where you started", points: 0 }] };
  }
  return {
    total: gain,
    parts: [
      { label: `Ended ${e.label}`, points: e.points },
      { label: `Started ${s.label}`, points: -s.points },
    ],
  };
}

export function describeCloseness(c: Closeness, target: string): string {
  if (c.distance === 1) return `Your last article links straight to ${target}. So close!`;
  if (c.distance === 2) return `You were two clicks away from ${target}.`;
  return `You were still a few clicks away from ${target}.`;
}

export interface Ranked {
  score: number;
  clicks: number;
  elapsed: number; // seconds
}

// Sort comparator, best first: higher score, then fewer clicks, then faster.
export function compareResults(a: Ranked, b: Ranked): number {
  return b.score - a.score || a.clicks - b.clicks || a.elapsed - b.elapsed;
}
