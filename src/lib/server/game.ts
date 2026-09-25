import "server-only";
import { after } from "next/server";
import { db, HttpError, must } from "@/lib/server/db";
import type { Player } from "@/lib/server/players";
import { broadcast } from "@/lib/server/realtime";
import { serverWiki } from "@/lib/server/wiki";
import { pickRoute } from "@/lib/targets";
import { DEFAULT_THEME, isTheme, type Theme } from "@/lib/theme";
import { apiHasLink, canonicalTitle, fetchExtract, normTitle } from "@/lib/wiki-core";
import {
  measureCloseness,
  scoreDnf,
  scoreFinish,
  type Closeness,
  type ScoreBreakdown,
} from "@/lib/scoring";
import type {
  ChatMessage,
  PathStep,
  RoomState,
  RoomStatus,
  RoundStatus,
  RunStatus,
  RunView,
} from "@/lib/room-types";

// All game rules live here and run on the server. Timing uses the server
// clock only; clients never report times, click counts, or scores.

const RECENT_ROUNDS = 60; // a new round avoids titles from this many latest rounds, all rooms
const COUNTDOWN_MS = 8000; // between "start" and the first allowed click
const GRACE_MS = 1500; // network slack after the time limit
const CLOSING_STALE_MS = 90_000; // a crashed close can be retried after this
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O

interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  rounds_total: number;
  time_limit: number;
  theme: Theme;
  show_images: boolean;
  created_at: string;
}
interface RoundRow {
  id: string;
  room_id: string;
  number: number;
  start_title: string;
  target_title: string;
  target_extract: string;
  time_limit: number;
  starts_at: string;
  status: RoundStatus;
  closing_at: string | null;
}
interface RunRow {
  id: string;
  round_id: string;
  player_id: string;
  stack: string[];
  path: PathStep[];
  clicks: number;
  status: RunStatus;
  elapsed_ms: number | null;
  score: number | null;
  score_parts: ScoreBreakdown["parts"] | null;
  closeness: Closeness | null;
}

const BASE_ROOM_COLS = "id, code, host_id, status, rounds_total, time_limit, created_at";
const ROOM_COLS = `${BASE_ROOM_COLS}, theme, show_images`;
// Migrations 0002 and 0003 add rooms.theme and rooms.show_images. Until they
// have run, rooms are read and written without them and use the defaults.
const MISSING_COLUMN = new Set(["42703", "PGRST204"]);
const missingColumn = (err: { code?: string } | null) => !!err && MISSING_COLUMN.has(err.code ?? "");
const ROUND_COLS =
  "id, room_id, number, start_title, target_title, target_extract, time_limit, starts_at, status, closing_at";
const RUN_COLS =
  "id, round_id, player_id, stack, path, clicks, status, elapsed_ms, score, score_parts, closeness";

function normCode(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(c)) throw new HttpError(404, "That room code doesn't exist.");
  return c;
}

async function loadRoom(code: string): Promise<RoomRow> {
  const c = normCode(code);
  const first = await db().from("rooms").select(ROOM_COLS).eq("code", c).maybeSingle();
  const res = missingColumn(first.error)
    ? await db().from("rooms").select(BASE_ROOM_COLS).eq("code", c).maybeSingle()
    : first;
  const room = must(res) as RoomRow | null;
  if (!room) throw new HttpError(404, "That room code doesn't exist.");
  return {
    ...room,
    theme: isTheme(room.theme) ? room.theme : DEFAULT_THEME,
    show_images: room.show_images ?? true,
  };
}

async function isMember(roomId: string, playerId: string): Promise<boolean> {
  const row = must(
    await db()
      .from("room_players")
      .select("player_id")
      .eq("room_id", roomId)
      .eq("player_id", playerId)
      .maybeSingle(),
  );
  return !!row;
}

// The room a rematch moved this room's players to: the host's next room.
// Rematch creates it the moment a game ends, so no schema link is needed.
// Players who missed the "rematch" broadcast (backgrounded tab, reconnect,
// refresh) find it through here on their next poll.
async function rematchRoom(room: RoomRow): Promise<{ id: string; code: string } | null> {
  if (room.status !== "finished") return null;
  return must(
    await db()
      .from("rooms")
      .select("id, code")
      .eq("host_id", room.host_id)
      .gt("created_at", room.created_at)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ) as { id: string; code: string } | null;
}

async function currentRound(roomId: string): Promise<RoundRow | null> {
  return must(
    await db()
      .from("rounds")
      .select(ROUND_COLS)
      .eq("room_id", roomId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as RoundRow | null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ---------------------------------------------------------------- rooms

export async function createRoom(
  player: Player,
  opts: { roundsTotal?: unknown; timeLimit?: unknown; theme?: unknown; images?: unknown },
): Promise<{ code: string }> {
  const roundsTotal = Math.min(10, Math.max(1, Math.round(Number(opts.roundsTotal) || 5)));
  const timeLimit = Math.min(600, Math.max(60, Math.round(Number(opts.timeLimit) || 180)));
  const theme = isTheme(opts.theme) ? opts.theme : DEFAULT_THEME;
  const showImages = opts.images !== false;
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from(
      { length: 4 },
      () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)],
    ).join("");
    const row = { code, host_id: player.id, rounds_total: roundsTotal, time_limit: timeLimit };
    const insert = (values: object) => db().from("rooms").insert(values).select("id").single();
    const first = await insert({ ...row, theme, show_images: showImages });
    const res = missingColumn(first.error) ? await insert(row) : first;
    if (res.error?.code === "23505") continue; // code taken, try another
    const room = must(res) as { id: string };
    must(await db().from("room_players").insert({ room_id: room.id, player_id: player.id }));
    return { code };
  }
  throw new Error("Couldn't find a free room code");
}

export async function joinRoom(player: Player, code: string): Promise<void> {
  const room = await loadRoom(code);
  if (!(await isMember(room.id, player.id))) {
    const res = await db().from("room_players").insert({ room_id: room.id, player_id: player.id });
    if (res.error && res.error.code !== "23505") must(res);
  }
  // Also covers a rejoin with a changed name.
  after(() => broadcast(room.code, { event: "refresh", payload: {} }));
}

/** The host picks the room's look, whether articles show images, and (until
 *  the game starts) the rounds and minutes; it changes for everyone. */
export async function updateSettings(
  player: Player,
  code: string,
  body: { theme?: unknown; images?: unknown; roundsTotal?: unknown; timeLimit?: unknown },
): Promise<void> {
  const patch: { theme?: Theme; show_images?: boolean; rounds_total?: number; time_limit?: number } = {};
  if (body.theme !== undefined) {
    if (!isTheme(body.theme)) throw new HttpError(400, "Unknown theme.");
    patch.theme = body.theme;
  }
  if (body.images !== undefined) {
    if (typeof body.images !== "boolean") throw new HttpError(400, "Bad images setting.");
    patch.show_images = body.images;
  }
  if (body.roundsTotal !== undefined) {
    const n = Number(body.roundsTotal);
    if (!Number.isInteger(n) || n < 1 || n > 10) throw new HttpError(400, "Rounds must be 1 to 10.");
    patch.rounds_total = n;
  }
  if (body.timeLimit !== undefined) {
    const n = Number(body.timeLimit);
    if (!Number.isInteger(n) || n < 60 || n > 600) throw new HttpError(400, "Time must be 1 to 10 minutes.");
    patch.time_limit = n;
  }
  if (!Object.keys(patch).length) throw new HttpError(400, "Nothing to change.");
  const room = await loadRoom(code);
  if (room.host_id !== player.id) throw new HttpError(403, "Only the host can change room settings.");
  if ((patch.rounds_total !== undefined || patch.time_limit !== undefined) && room.status !== "lobby") {
    throw new HttpError(409, "Rounds and time can't change once the game has started.");
  }
  const res = await db().from("rooms").update(patch).eq("id", room.id);
  if (missingColumn(res.error)) {
    throw new HttpError(503, "Room settings need a database update first (npm run db:migrate).");
  }
  must(res);
  after(() => broadcast(room.code, { event: "refresh", payload: {} }));
}

/** Room chat: not stored, just relayed to everyone in the room. */
export async function sendChat(player: Player, code: string, text: unknown): Promise<ChatMessage> {
  if (typeof text !== "string" || !text.trim()) throw new HttpError(400, "Type a message first.");
  const room = await loadRoom(code);
  if (!(await isMember(room.id, player.id))) throw new HttpError(403, "Join the room first.");
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    playerId: player.id,
    name: player.name,
    text,
    t: Date.now(),
  };
  await broadcast(room.code, { event: "chat", payload: msg });
  return msg;
}

// ---------------------------------------------------------------- state

function toRunView(run: RunRow, round: RoundRow, meId: string): RunView {
  const mine = run.player_id === meId;
  const visible = mine || round.status === "closed";
  const showScore = round.status === "closed" || (mine && run.status === "finished");
  return {
    playerId: run.player_id,
    clicks: run.clicks,
    status: run.status,
    elapsedMs: run.elapsed_ms,
    score: showScore ? run.score : null,
    scoreParts: showScore ? run.score_parts : null,
    closeness: round.status === "closed" ? run.closeness : null,
    current: visible ? (run.stack.at(-1) ?? null) : null,
    path: visible ? run.path : null,
    canGoBack: mine && run.status === "playing" && run.stack.length > 1,
  };
}

export async function getState(player: Player, code: string): Promise<RoomState> {
  const room = await loadRoom(code);
  if (!(await isMember(room.id, player.id))) throw new HttpError(403, "Join the room first.");

  const [members, rounds] = await Promise.all([
    db()
      .from("room_players")
      .select("player_id, joined_at, players(name)")
      .eq("room_id", room.id)
      .order("joined_at"),
    db().from("rounds").select(ROUND_COLS).eq("room_id", room.id).order("number"),
  ]);
  const memberRows = must(members) as unknown as {
    player_id: string;
    players: { name: string } | null;
  }[];
  const roundRows = must(rounds) as RoundRow[];
  const runRows = roundRows.length
    ? (must(
        await db()
          .from("runs")
          .select(RUN_COLS)
          .in(
            "round_id",
            roundRows.map((r) => r.id),
          ),
      ) as RunRow[])
    : [];

  const closedRounds = new Set(roundRows.filter((r) => r.status === "closed").map((r) => r.id));
  const totals = new Map<string, number>();
  for (const r of runRows) {
    if (closedRounds.has(r.round_id)) {
      totals.set(r.player_id, (totals.get(r.player_id) ?? 0) + (r.score ?? 0));
    }
  }

  const round = roundRows.at(-1) ?? null;
  const next = await rematchRoom(room);
  const nextCode = next && (await isMember(next.id, player.id)) ? next.code : null;
  return {
    serverNow: Date.now(),
    me: player.id,
    room: {
      code: room.code,
      status: room.status,
      hostId: room.host_id,
      roundsTotal: room.rounds_total,
      timeLimit: room.time_limit,
      theme: room.theme,
      images: room.show_images,
      nextCode,
    },
    players: memberRows.map((m) => ({
      id: m.player_id,
      name: m.players?.name ?? "Player",
      total: totals.get(m.player_id) ?? 0,
    })),
    round: round && {
      id: round.id,
      number: round.number,
      start: round.start_title,
      target: round.target_title,
      targetExtract: round.target_extract,
      timeLimit: round.time_limit,
      startsAt: Date.parse(round.starts_at),
      status: round.status,
    },
    runs: round
      ? runRows.filter((r) => r.round_id === round.id).map((r) => toRunView(r, round, player.id))
      : [],
  };
}

// ---------------------------------------------------------------- rounds

export async function startRound(player: Player, code: string): Promise<void> {
  const room = await loadRoom(code);
  if (room.host_id !== player.id) throw new HttpError(403, "Only the host can start a round.");
  if (room.status === "finished") throw new HttpError(409, "This game is over.");
  const cur = await currentRound(room.id);
  if (cur && cur.status !== "closed") throw new HttpError(409, "A round is already running.");
  const number = (cur?.number ?? 0) + 1;
  if (number > room.rounds_total) throw new HttpError(409, "All rounds have been played.");

  // Avoid anything this room has played, plus whatever was played most
  // recently across all rooms, so regulars don't keep meeting the same races.
  const [roomRounds, recentRounds] = await Promise.all([
    db().from("rounds").select("start_title, target_title").eq("room_id", room.id),
    db()
      .from("rounds")
      .select("start_title, target_title")
      .order("starts_at", { ascending: false })
      .limit(RECENT_ROUNDS),
  ]);
  const played = [
    ...(must(roomRounds) as { start_title: string; target_title: string }[]),
    ...(must(recentRounds) as { start_title: string; target_title: string }[]),
  ].flatMap((r) => [r.start_title, r.target_title]);

  const route = pickRoute(played);
  // Pool titles are canonical already; the lookup is a safety net, so
  // everything runs side by side.
  const [target, start, extract] = await Promise.all([
    canonicalTitle(route.target),
    serverWiki.pickCuratedStart(route.starts, route.target),
    fetchExtract(route.target).catch(() => ""),
  ]);

  const members = must(
    await db().from("room_players").select("player_id").eq("room_id", room.id),
  ) as { player_id: string }[];

  const res = await db()
    .from("rounds")
    .insert({
      room_id: room.id,
      number,
      start_title: start.title,
      target_title: target,
      target_extract: extract,
      time_limit: room.time_limit,
      starts_at: new Date(Date.now() + COUNTDOWN_MS).toISOString(),
    })
    .select("id")
    .single();
  if (res.error?.code === "23505") throw new HttpError(409, "A round is already running.");
  const round = must(res) as { id: string };

  must(
    await db()
      .from("runs")
      .insert(
        members.map((m) => ({
          round_id: round.id,
          player_id: m.player_id,
          stack: [start.title],
          path: [{ title: start.title, t: 0 }],
        })),
      ),
  );
  if (room.status === "lobby") {
    must(await db().from("rooms").update({ status: "playing" }).eq("id", room.id));
  }
  // The writes above can take seconds; restart the countdown now so players
  // still get all of it. Nobody can move yet, since starts_at is in the future.
  must(
    await db()
      .from("rounds")
      .update({ starts_at: new Date(Date.now() + COUNTDOWN_MS).toISOString() })
      .eq("id", round.id),
  );
  after(() => broadcast(room.code, { event: "refresh", payload: {} }));
}

async function loadMyRun(player: Player, code: string) {
  const room = await loadRoom(code);
  const round = await currentRound(room.id);
  if (!round || round.status !== "playing") throw new HttpError(409, "This round is over.");
  const run = must(
    await db()
      .from("runs")
      .select(RUN_COLS)
      .eq("round_id", round.id)
      .eq("player_id", player.id)
      .maybeSingle(),
  ) as RunRow | null;
  if (!run) throw new HttpError(403, "You're watching this round. You'll play the next one.");
  if (run.status !== "playing") throw new HttpError(409, "Your run is already over.");
  return { room, round, run, startsAt: Date.parse(round.starts_at) };
}

function checkClock(round: RoundRow, startsAt: number, code: string, now = Date.now()) {
  if (now < startsAt) throw new HttpError(409, "The round hasn't started yet.");
  if (now > startsAt + round.time_limit * 1000 + GRACE_MS) {
    after(() => tryClose(code));
    throw new HttpError(409, "Time's up.");
  }
}

export async function move(
  player: Player,
  code: string,
  body: { from?: unknown; via?: unknown; back?: unknown },
): Promise<RunView> {
  const { room, round, run, startsAt } = await loadMyRun(player, code);
  checkClock(round, startsAt, room.code);

  const top = run.stack.at(-1) ?? round.start_title;
  if (typeof body.from !== "string" || normTitle(body.from) !== normTitle(top)) {
    throw new HttpError(409, "Out of sync with the server.");
  }

  let stack: string[];
  let step: Omit<PathStep, "t">;
  if (body.back === true) {
    if (run.stack.length < 2) throw new HttpError(400, "There's nowhere to go back to.");
    stack = run.stack.slice(0, -1);
    step = { title: stack.at(-1)!, back: true };
  } else {
    const via = typeof body.via === "string" ? body.via.trim() : "";
    if (!via || via.length > 300 || via.includes("|")) throw new HttpError(400, "Bad link.");
    // Wikipedia's link table first; fall back to the rendered page, which is
    // what the player actually saw. The link check and the title lookup don't
    // depend on each other, so they run together.
    const [inLinkTable, canonical] = await Promise.all([
      apiHasLink(top, via).catch(() => false),
      canonicalTitle(via).catch(() => null),
    ]);
    const linked = inLinkTable || (await serverWiki.fetchArticle(top)).links.includes(normTitle(via));
    if (!linked) throw new HttpError(400, "That link isn't on this page.");
    if (!canonical) throw new HttpError(400, "That article doesn't exist.");
    const title = canonical;
    stack = [...run.stack, title];
    step = { title, via };
  }

  const now = Date.now();
  checkClock(round, startsAt, room.code, now);
  const t = now - startsAt;
  const clicks = run.clicks + 1; // going back counts as a click too
  const finished = normTitle(step.title) === normTitle(round.target_title);

  const patch: Record<string, unknown> = {
    stack,
    path: [...run.path, { ...step, t }],
    clicks,
  };
  if (finished) {
    const score = scoreFinish(clicks, round.time_limit - t / 1000);
    Object.assign(patch, {
      status: "finished",
      ended_at: new Date(now).toISOString(),
      elapsed_ms: t,
      score: score.total,
      score_parts: score.parts,
    });
  }

  // Optimistic concurrency: only apply if nothing changed since we read it.
  const updated = must(
    await db()
      .from("runs")
      .update(patch)
      .eq("id", run.id)
      .eq("clicks", run.clicks)
      .eq("status", "playing")
      .select(RUN_COLS)
      .maybeSingle(),
  ) as RunRow | null;
  if (!updated) throw new HttpError(409, "Out of sync with the server.");

  after(async () => {
    await broadcast(room.code, {
      event: "progress",
      payload: { playerId: player.id, clicks: updated.clicks, status: updated.status },
    });
    if (finished) await tryClose(room.code);
  });
  return toRunView(updated, round, player.id);
}

export async function giveUp(player: Player, code: string): Promise<RunView> {
  const { room, round, run, startsAt } = await loadMyRun(player, code);
  const now = Date.now();
  const updated = must(
    await db()
      .from("runs")
      .update({
        status: "gave_up",
        ended_at: new Date(now).toISOString(),
        elapsed_ms: Math.max(0, now - startsAt),
      })
      .eq("id", run.id)
      .eq("status", "playing")
      .select(RUN_COLS)
      .maybeSingle(),
  ) as RunRow | null;
  if (!updated) throw new HttpError(409, "Your run is already over.");
  after(async () => {
    await broadcast(room.code, {
      event: "progress",
      payload: { playerId: player.id, clicks: updated.clicks, status: updated.status },
    });
    await tryClose(room.code);
  });
  return toRunView(updated, round, player.id);
}

// Close the current round if time is up or everyone is done. Safe to call
// any number of times from any client: only one caller wins the claim.
export async function tryClose(code: string): Promise<void> {
  const room = await loadRoom(code);
  const round = await currentRound(room.id);
  if (!round || round.status === "closed") return;

  const now = Date.now();
  const startsAt = Date.parse(round.starts_at);
  const endsAt = startsAt + round.time_limit * 1000;
  if (round.status === "closing" && now - Date.parse(round.closing_at ?? "") < CLOSING_STALE_MS) {
    return; // someone else is closing it
  }
  let runs = must(
    await db().from("runs").select(RUN_COLS).eq("round_id", round.id),
  ) as RunRow[];
  const allDone = runs.every((r) => r.status !== "playing");
  if (now < endsAt + GRACE_MS && !allDone) return;

  const staleIso = new Date(now - CLOSING_STALE_MS).toISOString();
  const claimed = must(
    await db()
      .from("rounds")
      .update({ status: "closing", closing_at: new Date(now).toISOString() })
      .eq("id", round.id)
      .or(`status.eq.playing,and(status.eq.closing,closing_at.lt."${staleIso}")`)
      .select("id")
      .maybeSingle(),
  );
  if (!claimed) return;
  await broadcast(room.code, { event: "refresh", payload: {} });

  // Anyone still playing ran out of time where they stood.
  must(
    await db()
      .from("runs")
      .update({ status: "timed_out", ended_at: new Date(endsAt).toISOString() })
      .eq("round_id", round.id)
      .eq("status", "playing"),
  );
  runs = must(await db().from("runs").select(RUN_COLS).eq("round_id", round.id)) as RunRow[];

  // Score DNFs by progress: closeness where they stopped vs. the shared start.
  const dnfs = runs.filter((r) => r.status === "gave_up" || r.status === "timed_out");
  if (dnfs.length) {
    const target = round.target_title;
    const measure = async (title: string): Promise<Closeness | null> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const article = await serverWiki.fetchArticle(title);
          return await measureCloseness(article, target, serverWiki.closeDeps);
        } catch {
          // retry once, then give up on this title
        }
      }
      return null;
    };
    const endTitles = [...new Set(dnfs.map((r) => r.stack.at(-1) ?? round.start_title))];
    const [startC, ...ends] = await mapLimit([round.start_title, ...endTitles], 3, measure);
    const byTitle = new Map(endTitles.map((t, i) => [t, ends[i]]));

    await Promise.all(
      dnfs.map(async (r) => {
        const endC = byTitle.get(r.stack.at(-1) ?? round.start_title) ?? null;
        const score: ScoreBreakdown = endC
          ? scoreDnf(endC, startC)
          : { total: 0, parts: [{ label: "Couldn't measure how close you got", points: 0 }] };
        must(
          await db()
            .from("runs")
            .update({ score: score.total, score_parts: score.parts, closeness: endC })
            .eq("id", r.id),
        );
      }),
    );
  }

  must(
    await db()
      .from("rounds")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", round.id),
  );
  if (round.number >= room.rounds_total) {
    must(await db().from("rooms").update({ status: "finished" }).eq("id", room.id));
  }
  await broadcast(room.code, { event: "refresh", payload: {} });
}

export async function rematch(player: Player, code: string): Promise<{ code: string }> {
  const room = await loadRoom(code);
  if (room.host_id !== player.id) throw new HttpError(403, "Only the host can start a rematch.");
  if (room.status !== "finished") {
    // Closing the last round marks the room finished in a separate write; if
    // that write was lost, the game is still over, so repair it here.
    const last = await currentRound(room.id);
    if (last?.status !== "closed" || last.number < room.rounds_total) {
      throw new HttpError(409, "This game isn't over yet.");
    }
    must(await db().from("rooms").update({ status: "finished" }).eq("id", room.id));
    room.status = "finished";
  }
  // A second press (double click, second tab) returns the same new room
  // instead of splitting the players across two.
  const existing = await rematchRoom(room);
  if (existing) {
    after(() => broadcast(room.code, { event: "rematch", payload: { code: existing.code } }));
    return { code: existing.code };
  }
  const members = must(
    await db().from("room_players").select("player_id").eq("room_id", room.id),
  ) as { player_id: string }[];
  const next = await createRoom(player, {
    roundsTotal: room.rounds_total,
    timeLimit: room.time_limit,
    theme: room.theme,
    images: room.show_images,
  });
  const nextRoom = await loadRoom(next.code);
  const others = members.filter((m) => m.player_id !== player.id);
  if (others.length) {
    must(
      await db()
        .from("room_players")
        .insert(others.map((m) => ({ room_id: nextRoom.id, player_id: m.player_id }))),
    );
  }
  after(() => broadcast(room.code, { event: "rematch", payload: { code: next.code } }));
  return next;
}
