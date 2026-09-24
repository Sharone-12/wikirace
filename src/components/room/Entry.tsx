"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiCall } from "@/lib/client/api";
import { ensureIdentity, loadIdentity } from "@/lib/client/identity";

const input =
  "rounded-xl border-2 border-line bg-surface px-4 py-3 text-lg font-normal outline-none transition-colors focus:border-signal";
const btn =
  "rounded-xl bg-signal px-7 py-3.5 text-lg font-bold text-signal-ink transition-transform active:scale-[0.98] disabled:opacity-50";

/** Create a room or join one by code. */
export default function Entry() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rounds, setRounds] = useState(3);
  const [minutes, setMinutes] = useState(3);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the name this browser played under last time.
  useEffect(() => {
    const saved = loadIdentity()?.name;
    if (!saved) return;
    const t = setTimeout(() => setName((n) => n || saved), 0);
    return () => clearTimeout(t);
  }, []);

  const cleanCode = code.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const identity = await ensureIdentity(name.trim());
      const room = await apiCall<{ code: string }>("/api/rooms", {
        name: identity.name,
        roundsTotal: rounds,
        timeLimit: minutes * 60,
      });
      router.push(`/room/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || cleanCode.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      await ensureIdentity(name.trim()); // the room page sends the name on join
      router.push(`/room/${cleanCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-14">
      <Link href="/" className="text-sm font-medium text-muted underline">
        Play solo instead
      </Link>
      <h1 className="mt-6 text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
        Race your friends.
      </h1>
      <p className="mt-5 max-w-[46ch] text-lg text-muted">
        Everyone gets the same start and target. Fewest clicks and fastest time win the round.
      </p>

      <label className="mt-10 flex flex-col gap-1.5 text-sm font-medium">
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          disabled={busy}
          className={input}
        />
      </label>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <form onSubmit={create} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-xl font-bold">New room</h2>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              Rounds
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                disabled={busy}
                className="rounded-lg border-2 border-line bg-bg px-3 py-2"
              >
                {[1, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
              Minutes each
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                disabled={busy}
                className="rounded-lg border-2 border-line bg-bg px-3 py-2"
              >
                {[2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" disabled={!name.trim() || busy} className={`${btn} mt-auto`}>
            Create room
          </button>
        </form>

        <form onSubmit={join} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-xl font-bold">Join a room</h2>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Room code
            <input
              value={cleanCode}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className={`${input} uppercase tracking-[0.3em]`}
            />
          </label>
          <button
            type="submit"
            disabled={!name.trim() || cleanCode.length !== 4 || busy}
            className={`${btn} mt-auto`}
          >
            Join
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-stop/10 px-3 py-2 text-sm text-stop">
          {error}
        </p>
      )}
    </main>
  );
}
