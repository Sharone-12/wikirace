import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db, HttpError, must } from "@/lib/server/db";

// No accounts: a player is a random id plus a secret token kept in the
// browser. Only a hash of the token is stored.

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function cleanName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, 20) : "";
  if (!name) throw new HttpError(400, "Enter a name.");
  return name;
}

export async function createPlayer(rawName: unknown) {
  const name = cleanName(rawName);
  const token = randomBytes(24).toString("base64url");
  const row = must(
    await db().from("players").insert({ name, token_hash: hash(token) }).select("id").single(),
  ) as { id: string };
  return { id: row.id, name, token };
}

export interface Player {
  id: string;
  name: string;
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function authPlayer(req: Request): Promise<Player> {
  const id = req.headers.get("x-player-id") ?? "";
  const token = req.headers.get("x-player-token") ?? "";
  if (!UUID.test(id) || !token) throw new HttpError(401, "Enter your name to play.");
  const row = must(
    await db().from("players").select("id, name, token_hash").eq("id", id).maybeSingle(),
  ) as { id: string; name: string; token_hash: string } | null;
  if (!row) throw new HttpError(401, "Enter your name to play.");
  const a = Buffer.from(row.token_hash, "hex");
  const b = Buffer.from(hash(token), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, "Enter your name to play.");
  }
  return { id: row.id, name: row.name };
}

export async function renamePlayer(player: Player, rawName: unknown): Promise<Player> {
  const name = cleanName(rawName);
  if (name !== player.name) must(await db().from("players").update({ name }).eq("id", player.id));
  return { ...player, name };
}
