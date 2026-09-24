import "server-only";
import { db } from "@/lib/server/db";
import type { RoomEvent } from "@/lib/room-types";

// Send a broadcast to everyone in a room over HTTP (no socket needed).
// Broadcasts are hints; a failed send only delays clients until their next
// poll, so it is logged rather than thrown.
export async function broadcast(code: string, msg: RoomEvent): Promise<void> {
  const channel = db().channel(`room:${code}`);
  try {
    const res = await channel.httpSend(msg.event, msg.payload, { timeout: 5000 });
    if (!res.success) console.warn(`broadcast ${msg.event} to ${code} failed:`, res.error);
  } catch (e) {
    console.warn(`broadcast ${msg.event} to ${code} failed:`, e);
  } finally {
    await db().removeChannel(channel);
  }
}
