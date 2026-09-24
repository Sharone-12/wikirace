import { clearIdentity, loadIdentity } from "@/lib/client/identity";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Call our API with this browser's player credentials. */
export async function apiCall<T>(path: string, body?: unknown): Promise<T> {
  const identity = loadIdentity();
  const headers: Record<string, string> = {};
  if (identity) {
    headers["x-player-id"] = identity.id;
    headers["x-player-token"] = identity.token;
  }
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  // Our saved identity no longer exists on the server (e.g. database reset):
  // forget it so the next ensureIdentity() creates a fresh player.
  if (res.status === 401) clearIdentity();
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.");
  return data as T;
}
