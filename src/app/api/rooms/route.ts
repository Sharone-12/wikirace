import { createRoom } from "@/lib/server/game";
import { readBody, route } from "@/lib/server/http";
import { authPlayer } from "@/lib/server/players";

export const POST = route(async (req) => {
  const player = await authPlayer(req);
  const body = await readBody(req);
  return createRoom(player, { roundsTotal: body.roundsTotal, timeLimit: body.timeLimit });
});
