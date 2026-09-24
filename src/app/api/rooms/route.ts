import { createRoom } from "@/lib/server/game";
import { readBody, route } from "@/lib/server/http";
import { authPlayer, renamePlayer } from "@/lib/server/players";

export const POST = route(async (req) => {
  const body = await readBody(req);
  const authed = await authPlayer(req);
  const player = body.name === undefined ? authed : await renamePlayer(authed, body.name);
  return createRoom(player, { roundsTotal: body.roundsTotal, timeLimit: body.timeLimit });
});
