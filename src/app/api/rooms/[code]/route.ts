import { getState } from "@/lib/server/game";
import { route } from "@/lib/server/http";
import { authPlayer } from "@/lib/server/players";

export const GET = route(async (req, ctx: RouteContext<"/api/rooms/[code]">) => {
  const { code } = await ctx.params;
  return getState(await authPlayer(req), code);
});
