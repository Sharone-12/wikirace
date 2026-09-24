import { describe, expect, it } from "vitest";
import { pickRoute, START_POOL, TARGET_POOL } from "@/lib/targets";

describe("route pools", () => {
  it("have no duplicates and no title in both lists", () => {
    expect(new Set(TARGET_POOL).size).toBe(TARGET_POOL.length);
    expect(new Set(START_POOL).size).toBe(START_POOL.length);
    expect(START_POOL.filter((s) => TARGET_POOL.includes(s))).toEqual([]);
  });

  it("are big enough that repeats are rare", () => {
    expect(TARGET_POOL.length).toBeGreaterThanOrEqual(150);
    expect(START_POOL.length).toBeGreaterThanOrEqual(300);
  });
});

describe("pickRoute", () => {
  it("returns a target from the pool and every start in random order", () => {
    const { target, starts } = pickRoute();
    expect(TARGET_POOL).toContain(target);
    expect([...starts].sort()).toEqual([...START_POOL].sort());
  });

  it("skips recently played titles", () => {
    const recent = [...TARGET_POOL.slice(1), ...START_POOL.slice(5)];
    const { target, starts } = pickRoute(recent);
    expect(target).toBe(TARGET_POOL[0]);
    expect([...starts].sort()).toEqual([...START_POOL.slice(0, 5)].sort());
  });

  it("matches history loosely (case, underscores)", () => {
    const recent = TARGET_POOL.slice(1).map((t) => t.toLowerCase().replace(/ /g, "_"));
    expect(pickRoute(recent).target).toBe(TARGET_POOL[0]);
  });

  it("falls back to the whole pool once history has used it all up", () => {
    const { target, starts } = pickRoute([...TARGET_POOL, ...START_POOL]);
    expect(TARGET_POOL).toContain(target);
    expect(starts).toHaveLength(START_POOL.length);
  });
});
