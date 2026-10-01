# WikiRace

A real-time multiplayer Wikipedia race. Everyone starts on the same random
article and clicks links to reach a shared target as fast — and in as few
hops — as possible. Create a room, share the 4-letter code, and race.

## How a round works

1. The server picks a **start** article (an everyday, well-connected page —
   food, an animal, a film) and a **target** (a broad, heavily-linked hub
   like a country or a field of study) from curated pools, and announces a
   synchronized countdown so nobody gets a head start.
2. Each player's client fetches the Wikipedia article, sanitized and
   rewritten so every internal link becomes a click in the race instead of
   a navigation.
3. Clicks are broadcast live so everyone sees each other's click count and
   progress, without revealing which article anyone else is actually on.
4. Reaching the target (via a redirect-aware, canonicalized title match)
   finishes your run; giving up or running out of time ends it as a DNF.
5. When the round closes, the server scores every run and the room moves to
   the next round or the final leaderboard.

## What makes it more than a Wikipedia iframe

- **Server-rendered, sanitized Wikipedia pages.** Article HTML is parsed
  server-side (`linkedom`) and run through `DOMPurify` before any internal
  links are rewritten into click handlers — not a trust-the-source
  find-and-replace.
- **Server is the only source of truth.** Rooms, rounds, and runs are
  mediated entirely through API routes backed by `service_role` Supabase
  access; Row Level Security is enabled with no client grants at all, so
  the browser never talks to the database directly and can't fake a score,
  a timestamp, or a finish.
- **Curated, tested start/target pools** (`targets.ts`) instead of fully
  random pairs, so a round is actually winnable in a reasonable number of
  clicks rather than "List of municipalities in Norway" → "Quantum field
  theory."
- **A real scoring model** (`scoring.ts`, unit tested) that rewards both
  speed and path efficiency, not just first place.
- **Reconnect-safe by design.** Realtime broadcasts are treated as "something
  changed" pings only — clients always refetch authoritative state from the
  server, so a dropped wifi connection or a phone lock mid-round doesn't
  lose your run.
- **In-room chat and light/dark theming**, with host-configurable rounds,
  time limit, and theme/image settings for the lobby.

## Stack

- **Next.js** (App Router) + **React 19** + **TypeScript**
- **Supabase** — Postgres for room/round/run state, Realtime Broadcast for
  live progress
- **Tailwind CSS v4**
- **DOMPurify** + **linkedom** for safe server-side Wikipedia HTML handling
- **Vitest** for the scoring, target-pool, and wiki-parsing logic

## Project layout

```
src/
  app/
    api/
      players/              create a player
      rooms/                create a room
      rooms/[code]/         room state (poll/refresh)
      rooms/[code]/[action] join / start / click / give-up / etc.
    room/[code]/             the room UI (lobby -> race -> results)
  components/
    Game.tsx, RaceHeader.tsx, RouteLine.tsx, ThemeToggle.tsx
    room/                    Entry, Race, Room, Chat, progress + view components
  lib/
    wiki-core.ts             fetch + sanitize + rewrite a Wikipedia article
    targets.ts                curated start/target pools + pair selection
    scoring.ts                run -> score
    theme.ts                 light/dark theme definitions
    room-types.ts             shared types for the API and UI
    server/                   game.ts (room/round orchestration), db.ts, players.ts
    client/                   api.ts, identity.ts, realtime.ts, theme.ts
supabase/migrations/          schema (players, rooms, room_players, rounds, runs)
implementation.txt            the original design doc — problems, fixes, and build order
```

## Running locally

```bash
npm install
npm run db:migrate   # applies supabase/migrations against your project
npm run dev
```

You'll need a Supabase project and its URL / service role key in
`.env.local` for the API routes to talk to Postgres.

Run the test suite with:

```bash
npm test
```

## Status

Core single-player-feel rendering, room creation/joining, synchronized
round start, live progress, server-side scoring, and reconnect recovery are
implemented. See `implementation.txt` for the fuller design (difficulty
tiers, themed rounds, hub ban lists, replays, daily challenge) and which
pieces are still v2.
