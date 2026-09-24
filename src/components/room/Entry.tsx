"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { apiCall } from "@/lib/client/api";
import { ensureIdentity, loadIdentity } from "@/lib/client/identity";

const select =
  "frame w-full appearance-none rounded-full bg-bg px-4 py-2.5 font-bold outline-none focus:shadow-[0_0_0_3px_var(--ink)]";

function Chevron() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs">
      ▼
    </span>
  );
}

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
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <Brand tagline="multiplayer race" />
        <Link href="/" className="btn-line px-4 py-2 text-sm">
          Play solo
        </Link>
      </div>

      <h1 className="display mt-12 text-5xl sm:text-7xl">Race your friends.</h1>
      <p className="mt-5 max-w-[46ch] text-lg text-muted">
        Everyone gets the same start and target. Fewest clicks and fastest time win the round.
      </p>

      <label className="frame mt-10 flex flex-col gap-1.5 rounded-[22px] bg-surface p-4">
        <span className="kicker text-muted">Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          disabled={busy}
          className="field text-lg"
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <form onSubmit={create} className="frame relative flex flex-col gap-4 rounded-[22px] bg-sun p-5">
          <div className="flex items-start justify-between">
            <span className="text-[21px] font-extrabold tracking-tight">01</span>
            <span className="font-bold" aria-hidden="true">
              ↗
            </span>
          </div>
          <h2 className="-mt-2 text-2xl font-black tracking-tight">New room</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="kicker">Rounds</span>
              <span className="relative">
                <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} disabled={busy} className={select}>
                  {[1, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <Chevron />
              </span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="kicker">Minutes each</span>
              <span className="relative">
                <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} disabled={busy} className={select}>
                  {[2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <Chevron />
              </span>
            </label>
          </div>
          <button type="submit" disabled={!name.trim() || busy} className="btn-ink mt-auto">
            Create room →
          </button>
        </form>

        <form onSubmit={join} className="frame flex flex-col gap-4 rounded-[22px] bg-signal p-5 text-white">
          <div className="flex items-start justify-between">
            <span className="text-[21px] font-extrabold tracking-tight">02</span>
            <span className="font-bold" aria-hidden="true">
              ↗
            </span>
          </div>
          <h2 className="-mt-2 text-2xl font-black tracking-tight">Join a room</h2>
          <label className="flex flex-col gap-1.5">
            <span className="kicker">Room code</span>
            <input
              value={cleanCode}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="field text-center text-2xl font-black uppercase tracking-[0.4em]"
            />
          </label>
          <button
            type="submit"
            disabled={!name.trim() || cleanCode.length !== 4 || busy}
            className="btn-ink mt-auto"
          >
            Join →
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="frame mt-4 rounded-2xl bg-stop px-3.5 py-2.5 text-sm font-semibold text-white">
          {error}
        </p>
      )}
    </main>
  );
}
