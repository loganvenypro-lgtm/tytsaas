/**
 * YouTube calls made on the user's behalf, with the Google OAuth tokens Better
 * Auth keeps in "account" (linked from /my-channel with the scopes below). Only
 * what needs the user's consent goes through here: which channel is theirs
 * (channels.list mine=true, 1 Data API unit) and YouTube Analytics (its own
 * quota, not the Data API's). Public data keeps going through lib/youtube.js.
 */
import { auth } from "./auth.js";
import { sql } from "./sql.js";

export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const ANALYTICS_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";

const DATA_API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";
const PACIFIC_DAY = sql`(now() at time zone 'America/Los_Angeles')::date`;

/** The token is missing, revoked or lacks a scope: the user has to link Google again. */
export class ReconnectError extends Error {}

const hasScope = (scope, wanted) => (scope ?? "").split(/[\s,]+/).includes(wanted);

/**
 * The user's Google account that granted YouTube access (the latest one when
 * several Google accounts are linked), with the scopes it carries.
 */
export async function youtubeAccount(userId) {
  const rows = await sql`
    SELECT id, scope, "updatedAt" FROM account
    WHERE "userId" = ${userId} AND "providerId" = 'google'
    ORDER BY "updatedAt" DESC`;
  const linked = rows.find((r) => hasScope(r.scope, YOUTUBE_SCOPE));
  return {
    google: rows.length > 0,
    accountId: linked?.id ?? null,
    youtube: Boolean(linked),
    analytics: Boolean(linked && hasScope(linked.scope, ANALYTICS_SCOPE)),
  };
}

/** A valid access token for that account; Better Auth refreshes it when it has expired. */
async function accessToken(userId, accountId) {
  try {
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId, userId } });
    if (!accessToken) throw new Error("empty token");
    return accessToken;
  } catch (err) {
    throw new ReconnectError(`Google token unavailable: ${err.message}`);
  }
}

async function googleGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    const reason = body.error?.errors?.[0]?.reason ?? body.error?.status ?? `HTTP ${res.status}`;
    // A quota refusal is not the user's fault: keep it apart from a missing consent
    // Neither is a disabled API in our Cloud project (accessNotConfigured): reconnecting won't fix it
    if (/quota|rateLimit|accessNotConfigured/i.test(reason)) throw new Error(`Google API: ${reason}`);
    throw new ReconnectError(`Google API: ${reason}`);
  }
  if (!res.ok) throw new Error(`Google API: ${body.error?.message ?? `HTTP ${res.status}`}`);
  return body;
}

/** The channel the user picked at consent (channels.list mine=true, 1 unit, counted in api_quota_usage). */
export async function fetchMyChannel(userId, accountId, parts) {
  const token = await accessToken(userId, accountId);
  const query = new URLSearchParams({ part: parts, mine: "true" });
  const data = await googleGet(`${DATA_API}/channels?${query}`, token);
  await sql`
    insert into api_quota_usage (day, units, calls)
    values (${PACIFIC_DAY}, 1, jsonb_build_object('channels.mine', 1))
    on conflict (day) do update set
      units = api_quota_usage.units + 1,
      calls = api_quota_usage.calls || jsonb_build_object(
        'channels.mine', coalesce((api_quota_usage.calls->>'channels.mine')::int, 0) + 1
      )`;
  return data.items?.[0] ?? null;
}

/** One YouTube Analytics report on the user's channel ({ columnHeaders, rows }). */
export async function analyticsReport(userId, accountId, params) {
  const token = await accessToken(userId, accountId);
  const query = new URLSearchParams({ ids: "channel==MINE", ...params });
  return googleGet(`${ANALYTICS_API}?${query}`, token);
}

/** Analytics rows as objects keyed by column name. */
export function reportRows(report) {
  const names = (report.columnHeaders ?? []).map((h) => h.name);
  return (report.rows ?? []).map((row) => Object.fromEntries(names.map((name, i) => [name, row[i]])));
}

/**
 * A cached value of my_channel_cache, recomputed by `load` once older than
 * `maxAgeHours`. When `load` fails, the stale value is served if there is one.
 */
export async function cached(userId, key, maxAgeHours, load) {
  const [row] = await sql`SELECT data, fetched_at FROM my_channel_cache WHERE user_id = ${userId} AND key = ${key}`;
  if (row && Date.now() - new Date(row.fetched_at).getTime() < maxAgeHours * 3_600_000) return row.data;
  try {
    const data = await load();
    await sql`
      INSERT INTO my_channel_cache (user_id, key, data) VALUES (${userId}, ${key}, ${sql.json(data)})
      ON CONFLICT (user_id, key) DO UPDATE SET data = excluded.data, fetched_at = now()`;
    return data;
  } catch (err) {
    if (row && !(err instanceof ReconnectError)) return row.data;
    throw err;
  }
}
