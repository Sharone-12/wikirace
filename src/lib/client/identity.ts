// The player's identity lives in this browser: a random id and secret token
// from POST /api/players. No accounts; clearing site data makes a new player.

export interface Identity {
  id: string;
  token: string;
  name: string;
}

const KEY = "wikirace:player";

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.id === "string" && typeof v.token === "string" ? v : null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Private mode or storage blocked: the identity lasts for this page only.
  }
}

export function clearIdentity(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Existing identity or a new one from the server. A changed name is only
 * saved locally here; send it as `name` to create/join so the server
 * updates it too.
 */
export async function ensureIdentity(name: string): Promise<Identity> {
  const current = loadIdentity();
  if (current) {
    const updated = { ...current, name };
    saveIdentity(updated);
    return updated;
  }
  const res = await fetch("/api/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.id !== "string" || typeof body.token !== "string") {
    throw new Error(body.error ?? "Couldn't save your name. Try again.");
  }
  const identity: Identity = { id: body.id, token: body.token, name: typeof body.name === "string" ? body.name : name };
  saveIdentity(identity);
  return identity;
}
