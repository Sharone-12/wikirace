import { describe, expect, it, vi } from "vitest";
import {
  closenessPoints,
  compareResults,
  FINISH_BASE,
  MAX_ROUTES,
  MAX_VERIFY,
  measureCloseness,
  scoreDnf,
  scoreFinish,
  type CloseDeps,
  type Closeness,
} from "@/lib/scoring";
import { normTitle } from "@/lib/wiki-core";

const TARGET = "United States";

// A fake Wikipedia: title -> rendered (clickable) links.
function fakeDeps(
  pages: Record<string, string[]>,
  opts: { aliases?: string[]; linkers?: string[]; aliasesFail?: boolean } = {},
): CloseDeps & { getArticle: ReturnType<typeof vi.fn> } {
  return {
    aliases: opts.aliasesFail
      ? () => Promise.reject(new Error("offline"))
      : () => Promise.resolve(opts.aliases ?? []),
    linkersOf: () => Promise.resolve(opts.linkers ?? []),
    getArticle: vi.fn((title: string) => {
      const links = pages[normTitle(title)];
      return links ? Promise.resolve({ title, links }) : Promise.reject(new Error("404"));
    }),
  };
}

describe("normTitle", () => {
  it("treats underscores and first-letter case as equal", () => {
    expect(normTitle("united_States")).toBe("United States");
    expect(normTitle(" Europe ")).toBe("Europe");
  });
});

describe("scoreFinish", () => {
  it("adds finish base, time left and few-clicks bonus", () => {
    expect(scoreFinish(1, 170).total).toBe(FINISH_BASE + 340 + 190);
  });
  it("rewards speed and fewer clicks", () => {
    expect(scoreFinish(5, 100).total).toBeGreaterThan(scoreFinish(5, 50).total);
    expect(scoreFinish(4, 100).total).toBeGreaterThan(scoreFinish(9, 100).total);
  });
  it("never goes below the finish base", () => {
    expect(scoreFinish(500, -5).total).toBe(FINISH_BASE);
  });
  it("breakdown parts sum to the total", () => {
    const s = scoreFinish(7, 61);
    expect(s.parts.reduce((n, p) => n + p.points, 0)).toBe(s.total);
  });
});

describe("scoreDnf", () => {
  const c = (over: Partial<Closeness>): Closeness => ({
    distance: 3,
    routes: 0,
    overlap: 0,
    ...over,
  });

  it("ranks closer tiers higher", () => {
    const one = closenessPoints(c({ distance: 1 })).points;
    const two = closenessPoints(c({ distance: 2, routes: 1 })).points;
    const far = closenessPoints(c({ distance: 3, overlap: 1 })).points;
    expect(one).toBeGreaterThan(two);
    expect(two).toBeGreaterThan(far);
  });
  it("caps the routes bonus", () => {
    expect(closenessPoints(c({ distance: 2, routes: 50 })).points).toBe(400);
    expect(closenessPoints(c({ distance: 2, routes: MAX_ROUTES })).points).toBe(400);
  });
  it("grades far-away positions by topic overlap", () => {
    expect(closenessPoints(c({ overlap: 0 })).points).toBe(20);
    expect(closenessPoints(c({ overlap: 0.05 })).points).toBeGreaterThan(20);
    expect(closenessPoints(c({ overlap: 5 })).points).toBe(80); // capped
  });
  it("no DNF can outrank a finish", () => {
    expect(scoreDnf(c({ distance: 1 }), c({ overlap: 0 })).total).toBeLessThan(FINISH_BASE);
    expect(scoreDnf(c({ distance: 1 }), null).total).toBeLessThan(FINISH_BASE);
  });

  it("scores progress: end closeness minus start closeness", () => {
    const s = scoreDnf(c({ distance: 1 }), c({ distance: 3, overlap: 0 }));
    expect(s.total).toBe(480);
    expect(s.parts.reduce((n, p) => n + p.points, 0)).toBe(s.total);
  });
  it("giving up on a start that was already close scores 0", () => {
    const start = c({ distance: 2, routes: 3 });
    expect(scoreDnf(start, start).total).toBe(0);
  });
  it("wandering further away scores 0, never negative", () => {
    expect(scoreDnf(c({ distance: 3 }), c({ distance: 2, routes: 1 })).total).toBe(0);
  });
  it("more progress from the same start ranks higher", () => {
    const start = c({ distance: 3, overlap: 0 });
    expect(scoreDnf(c({ distance: 1 }), start).total).toBeGreaterThan(
      scoreDnf(c({ distance: 2, routes: 2 }), start).total,
    );
  });
  it("falls back to end closeness when the start wasn't measured", () => {
    expect(scoreDnf(c({ distance: 2, routes: 1 }), null).total).toBe(265);
  });
});

describe("compareResults", () => {
  it("sorts by score, then clicks, then time", () => {
    const rows = [
      { id: "slow", score: 500, clicks: 5, elapsed: 90 },
      { id: "top", score: 900, clicks: 9, elapsed: 99 },
      { id: "fewer", score: 500, clicks: 3, elapsed: 120 },
      { id: "fast", score: 500, clicks: 5, elapsed: 60 },
    ];
    expect(rows.sort(compareResults).map((r) => r.id)).toEqual(["top", "fewer", "fast", "slow"]);
  });
});

describe("measureCloseness", () => {
  const article = (links: string[]) => ({ title: "Start", links });

  it("distance 1: rendered page links straight to the target", async () => {
    const d = fakeDeps({});
    const r = await measureCloseness(article(["Foo", "United States"]), TARGET, d);
    expect(r.distance).toBe(1);
  });

  it("distance 1: a redirect alias of the target counts", async () => {
    const d = fakeDeps({}, { aliases: ["USA", "U.S."] });
    const r = await measureCloseness(article(["Foo", "USA"]), TARGET, d);
    expect(r.distance).toBe(1);
  });

  it("does not count a link the API sees but the rendered page lacks (navbox)", async () => {
    // API prefilter says "Navbox Page" links to the target, but its rendered
    // (navbox-stripped) links do not include it.
    const d = fakeDeps(
      { "Navbox Page": ["Something else"], [TARGET]: ["Foo", "Bar"] },
      { linkers: ["Navbox Page"] },
    );
    const r = await measureCloseness(article(["Navbox Page", "Foo"]), TARGET, d);
    expect(r.distance).toBe(3);
    expect(r.routes).toBe(0);
  });

  it("distance 2: confirmed by the neighbour's rendered links", async () => {
    const d = fakeDeps(
      { "Good Page": ["United States"], "Navbox Page": ["x"] },
      { linkers: ["Good Page", "Navbox Page"] },
    );
    const r = await measureCloseness(article(["Good Page", "Navbox Page"]), TARGET, d);
    expect(r.distance).toBe(2);
    expect(r.routes).toBe(1);
  });

  it("distance 2: a neighbour linking via an alias counts", async () => {
    const d = fakeDeps({ "Good Page": ["USA"] }, { linkers: ["Good Page"], aliases: ["USA"] });
    const r = await measureCloseness(article(["Good Page"]), TARGET, d);
    expect(r.distance).toBe(2);
  });

  it("stops verifying once enough routes are found, and never exceeds the cap", async () => {
    const titles = Array.from({ length: 60 }, (_, i) => `N${i}`);
    const pages = Object.fromEntries(titles.map((t) => [t, ["United States"]]));
    const d = fakeDeps(pages, { linkers: titles });
    const r = await measureCloseness(article(titles), TARGET, d);
    expect(r.routes).toBe(MAX_ROUTES);
    expect(d.getArticle.mock.calls.length).toBeLessThanOrEqual(MAX_VERIFY);
  });

  it("survives a failed neighbour fetch", async () => {
    const d = fakeDeps({ Ok: ["United States"] }, { linkers: ["Missing", "Ok"] });
    const r = await measureCloseness(article(["Missing", "Ok"]), TARGET, d);
    expect(r.distance).toBe(2);
    expect(r.routes).toBe(1);
  });

  it("survives a failed alias lookup", async () => {
    const d = fakeDeps({}, { aliasesFail: true });
    const r = await measureCloseness(article(["United States"]), TARGET, d);
    expect(r.distance).toBe(1);
  });

  it("distance 3: overlap rises with shared links and is 0 when unrelated", async () => {
    const targetLinks = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const related = await measureCloseness(
      article(["A", "B", "C", "X"]),
      TARGET,
      fakeDeps({ [TARGET]: targetLinks }),
    );
    const unrelated = await measureCloseness(
      article(["X", "Y", "Z"]),
      TARGET,
      fakeDeps({ [TARGET]: targetLinks }),
    );
    expect(related.distance).toBe(3);
    expect(related.overlap).toBeGreaterThan(unrelated.overlap);
    expect(unrelated.overlap).toBe(0);
  });
});
