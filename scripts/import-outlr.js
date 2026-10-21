// One-time import of the old Outlr database into this one.
// - users -> Better Auth "user" + "account" (passwords keep their PBKDF2 hash, see lib/auth.js)
// - every other table is copied as-is (schema + data) with pg_dump, and its
//   foreign keys to the old users table now point to "user".
//
// Needs read access on the old database (scripts/create-db-role.ps1 -GrantReadOn newiq).
// Usage: npm run import:outlr
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";

const PG_BIN = process.env.PG_BIN ?? "C:\\Program Files\\PostgreSQL\\18\\bin";
const target = new URL(process.env.DATABASE_URL);
const source = new URL(process.env.OUTLR_DATABASE_URL ?? process.env.DATABASE_URL);
if (!process.env.OUTLR_DATABASE_URL) source.pathname = "/newiq";

function pgTool(tool, args, url) {
  const res = spawnSync(path.join(PG_BIN, `${tool}.exe`), [
    "-h", url.hostname, "-p", url.port || "5432",
    "-U", decodeURIComponent(url.username),
    "-d", decodeURIComponent(url.pathname.slice(1)),
    ...args,
  ], { env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${tool} failed:\n${res.stderr}`);
  return res.stdout;
}

const src = new pg.Client({ connectionString: source.toString() });
const dst = new pg.Client({ connectionString: target.toString() });
await src.connect();
await dst.connect();

const { rowCount: alreadyImported } = await dst.query(
  "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'channels'"
);
if (alreadyImported) {
  console.error("Outlr data is already imported (table channels exists). Nothing done.");
  process.exit(1);
}

// 1. Users first: the copied tables' foreign keys need them to exist
const { rows: users } = await src.query("select * from users order by created_at");
const emails = users.map((u) => u.email.trim().toLowerCase());
const { rows: clashes } = await dst.query('select email from "user" where email = any($1)', [emails]);
if (clashes.length) {
  console.error("These emails already have an account here:", clashes.map((c) => c.email).join(", "));
  process.exit(1);
}

await dst.query("begin");
for (const u of users) {
  await dst.query(
    `insert into "user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt",
                         role, plan, youtube_channel_id, competitor_channel_ids)
     values ($1, $2, $3, false, $4, coalesce($5, now()), coalesce($6, now()), $7, coalesce($8, 'Pro'), $9, coalesce($10::text[], '{}'))`,
    [u.id, u.name, u.email.trim().toLowerCase(), u.avatar, u.created_at, u.updated_at,
     u.role ?? "user", u.plan, u.youtube_channel_id, u.competitor_channel_ids]
  );
  await dst.query(
    `insert into account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     values ($1, $2, 'credential', $2, $3, coalesce($4, now()), coalesce($5, now()))`,
    [randomUUID(), u.id, `pbkdf2$${u.password_hash}`, u.created_at, u.updated_at]
  );
}
await dst.query("commit");
console.log(`Imported ${users.length} users (${users.filter((u) => u.role === "admin").length} admins)`);

// 2. Every other table, schema and data, in one transaction
const dir = mkdtempSync(path.join(tmpdir(), "outlr-import-"));
try {
  const dump = path.join(dir, "outlr.sql");
  pgTool("pg_dump", ["--no-owner", "--no-privileges", "--exclude-table=public.users", "-f", dump], source);
  const sql = readFileSync(dump, "utf8").replaceAll("REFERENCES public.users(", 'REFERENCES public."user"(');
  writeFileSync(dump, sql);
  pgTool("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-1", "-f", dump], target);
} catch (err) {
  // Leave the database as it was before the import
  await dst.query('delete from "user" where id = any($1)', [users.map((u) => u.id)]);
  throw err;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const { rows: tables } = await dst.query(
  "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"
);
for (const { table_name } of tables) {
  const { rows: [{ n }] } = await dst.query(`select count(*)::int as n from "${table_name}"`);
  console.log(`${table_name.padEnd(30)} ${n}`);
}
await src.end();
await dst.end();
