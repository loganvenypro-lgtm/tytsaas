import crypto from "node:crypto";
import { sql } from "./sql.js";

export const MCP_KEY_NAME_MAX = 80;
export const MCP_KEYS_PER_USER = 10;

const KEY_PREFIX = "tyt_";
// Keys created in Outlr were imported with their hash and still work
const ACCEPTED_PREFIXES = [KEY_PREFIX, "outlr_"];

const hashKey = (key) => crypto.createHash("sha256").update(key).digest("hex");

export function mcpKeyJson(r) {
  return {
    id: r.id,
    name: r.name,
    prefix: r.key_prefix,
    createdAt: new Date(r.created_at).toISOString(),
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
  };
}

/** The user's active keys, newest first. */
export async function listMcpKeys(userId) {
  const rows = await sql`
    SELECT id, name, key_prefix, created_at, last_used_at FROM mcp_api_keys
    WHERE user_id = ${userId} AND revoked_at IS NULL
    ORDER BY created_at DESC`;
  return rows.map(mcpKeyJson);
}

export async function countMcpKeys(userId) {
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM mcp_api_keys WHERE user_id = ${userId} AND revoked_at IS NULL`;
  return count;
}

/** Creates a key for the user. The plain key is returned only here, never stored. */
export async function createMcpKey(userId, name) {
  const key = `${KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  const [row] = await sql`
    INSERT INTO mcp_api_keys (id, user_id, name, key_hash, key_prefix)
    VALUES (${crypto.randomBytes(12).toString("hex")}, ${userId}, ${name}, ${hashKey(key)}, ${key.slice(0, 12)})
    RETURNING id, name, key_prefix, created_at, last_used_at`;
  return { key, record: mcpKeyJson(row) };
}

/** Revokes one of the user's keys; false if it doesn't exist or isn't theirs. */
export async function revokeMcpKey(userId, id) {
  const rows = await sql`
    UPDATE mcp_api_keys SET revoked_at = now()
    WHERE id = ${id} AND user_id = ${userId} AND revoked_at IS NULL
    RETURNING id`;
  return rows.length > 0;
}

/** Resolves a key sent to /api/mcp to its owner, or null if unknown, revoked or banned. */
export async function resolveMcpKey(key) {
  if (!ACCEPTED_PREFIXES.some((p) => key.startsWith(p))) return null;
  const [row] = await sql`
    UPDATE mcp_api_keys k SET last_used_at = now()
    FROM "user" u
    WHERE k.key_hash = ${hashKey(key)} AND k.revoked_at IS NULL AND u.id = k.user_id
      AND (u.banned IS NOT TRUE OR u."banExpires" < now())
    RETURNING u.id, u.role`;
  if (!row) return null;
  return { userId: row.id, isAdmin: row.role === "admin" };
}
