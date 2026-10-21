// Creates the database if missing, then runs every schema/*.sql file in order.
// Usage: npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL);
const dbName = decodeURIComponent(url.pathname.slice(1));

const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
const { rowCount } = await admin.query(
  "select 1 from pg_database where datname = $1",
  [dbName]
);
if (!rowCount) {
  await admin.query(`create database "${dbName.replaceAll('"', '""')}"`);
  console.log(`Created database ${dbName}`);
}
await admin.end();

const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
const files = (await readdir("schema")).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  await client.query(await readFile(`schema/${file}`, "utf8"));
  console.log(`Applied ${file}`);
}
await client.end();
