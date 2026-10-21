import postgres from "postgres";

// App queries (tagged templates). Better Auth keeps its own pg pool in lib/db.js.
export const sql = postgres(process.env.DATABASE_URL);
