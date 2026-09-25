import { HttpError } from "@/lib/server/db";
import {
  getState,
  giveUp,
  joinRoom,
  move,
  rematch,
  sendChat,
  startRound,
  tryClose,
  updateSettings,
} from "@/lib/server/game";
import { readBody, route } from "@/lib/server/http";
import { authPlayer, renamePlayer } from "@/lib/server/players";

// Closing a round measures every DNF against Wikipedia, which can take a while.
export const maxDuration = 60;

export const POST = route(async (req, ctx: RouteContext<"/api/rooms/[code]/[action]">) => {
  const { code, action } = await ctx.params;
  const player = await authPlayer(req);
  const body = await readBody(req);

  switch (action) {
    case "join": {
      const renamed = body.name === undefined ? player : await renamePlayer(player, body.name);
      await joinRoom(renamed, code);
      return getState(renamed, code);
    }
    case "start":
      await startRound(player, code);
      return getState(player, code);
    case "move":
      return move(player, code, body);
    case "give-up":
      return giveUp(player, code);
    case "close":
      await tryClose(code);
      return getState(player, code);
    case "rematch":
      return rematch(player, code);
    case "chat":
      return sendChat(player, code, body.text);
    case "settings":
      await updateSettings(player, code, body);
      return getState(player, code);
    default:
      throw new HttpError(404, "Unknown action.");
  }
});
