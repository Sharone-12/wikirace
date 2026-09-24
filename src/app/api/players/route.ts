import { readBody, route } from "@/lib/server/http";
import { createPlayer } from "@/lib/server/players";

// Create an identity: returns { id, name, token }. The token is only ever
// returned here; the browser keeps it.
export const POST = route(async (req) => createPlayer((await readBody(req)).name));
