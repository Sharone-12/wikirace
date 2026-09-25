// Shapes shared by the multiplayer API routes and the room UI.
import type { Closeness, ScoreBreakdown } from "@/lib/scoring";
import type { Theme } from "@/lib/theme";

export type RoomStatus = "lobby" | "playing" | "finished";
export type RoundStatus = "playing" | "closing" | "closed";
export type RunStatus = "playing" | "finished" | "gave_up" | "timed_out";

export interface PathStep {
  title: string; // canonical article title
  via?: string; // link target as clicked (before redirects)
  back?: boolean; // reached with the Back button
  t: number; // ms since the round started (server clock)
}

export interface RunView {
  playerId: string;
  clicks: number;
  status: RunStatus;
  elapsedMs: number | null;
  score: number | null;
  scoreParts: ScoreBreakdown["parts"] | null;
  closeness: Closeness | null;
  // Only visible for your own run, or for everyone once the round is closed.
  current: string | null;
  path: PathStep[] | null;
  canGoBack: boolean;
}

export interface RoomState {
  serverNow: number; // ms epoch, for clock-skew correction
  me: string; // your player id
  room: {
    code: string;
    status: RoomStatus;
    hostId: string;
    roundsTotal: number;
    timeLimit: number; // seconds
    theme: Theme; // chosen by the host, shown to everyone in the room
    images: boolean; // whether articles show their images, also the host's call
    nextCode: string | null; // after a rematch: the room everyone moved to
  };
  players: { id: string; name: string; total: number }[];
  round: null | {
    id: string;
    number: number;
    start: string;
    target: string;
    targetExtract: string;
    timeLimit: number;
    startsAt: number; // ms epoch
    status: RoundStatus;
  };
  runs: RunView[];
}

// Realtime broadcast events on channel `room:{code}`. They are hints only:
// the API is the source of truth, and clients refetch state on "refresh".
export type RoomEvent =
  | { event: "refresh"; payload: Record<string, never> }
  | { event: "progress"; payload: { playerId: string; clicks: number; status: RunStatus } }
  | { event: "rematch"; payload: { code: string } };
