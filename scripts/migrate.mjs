// Apply supabase/migrations/*.sql in order. Run: npm run db:migrate
//
// Uses the Supabase Management API over HTTPS (port 443), because direct
// Postgres ports are often blocked on school/office networks. Needs:
//   NEXT_PUBLIC_SUPABASE_URL  (from .env.local, via `vercel env pull`)
//   SUPABASE_ACCESS_TOKEN     (a personal access token, kept in .env.admin.local)
// Secrets are never printed.

import { readdirSync, readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is not set (put it in .env.admin.local)");
if (!projectUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set (run: vercel env pull)");
const ref = new URL(projectUrl).hostname.split(".")[0];

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : [];
}

const quote = (s) => `'${s.replace(/'/g, "''")}'`;

await query(`
  create table if not exists public._migrations (name text primary key, applied_at timestamptz default now());
  alter table public._migrations enable row level security;
  revoke all on public._migrations from anon, authenticated;
`);
const done = new Set((await query("select name from public._migrations")).map((r) => r.name));

const dir = new URL("../supabase/migrations/", import.meta.url);
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  const sql = readFileSync(new URL(file, dir), "utf8");
  // One request = one implicit transaction: the migration and its record
  // either both apply or neither does.
  await query(`begin;\n${sql}\ninsert into public._migrations (name) values (${quote(file)});\ncommit;`);
  console.log("applied", file);
}
console.log("migrations up to date");
