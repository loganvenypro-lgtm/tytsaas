/**
 * YouTube access for the worker. Two kinds of sources:
 *   - Data API v3 (quota): every call goes through youtubeApi(), which records
 *     the units in api_quota_usage (quota resets at midnight Pacific time).
 *   - Free public endpoints (no quota): channel RSS feeds, the /shorts/ URL
 *     (200 = Short, 303 = regular video) and the thumbnail CDN's ETag.
 */
import { sql } from "./sql.js";

const API_BASE = "https://www.googleapis.com/youtube/v3";
const USER_AGENT = "Mozilla/5.0 (compatible; TytScanner/1.0)";
// Skips the EU cookie consent redirect on www.youtube.com.
const CONSENT_COOKIE = "SOCS=CAI; CONSENT=YES+";

/** Units per call (https://developers.google.com/youtube/v3/determine_quota_cost). */
export const QUOTA_COST = {
  videos: 1,
  channels: 1,
  playlistItems: 1,
  channelSections: 1,
  search: 100,
};

export class QuotaExceededError extends Error {}

const PACIFIC_DAY = sql`(now() at time zone 'America/Los_Angeles')::date`;

export async function quotaUsedToday() {
  const [row] = await sql`select units from api_quota_usage where day = ${PACIFIC_DAY}`;
  return row?.units ?? 0;
}

async function recordQuota(endpoint, units) {
  await sql`
    insert into api_quota_usage (day, units, calls)
    values (${PACIFIC_DAY}, ${units}, jsonb_build_object(${endpoint}::text, 1))
    on conflict (day) do update set
      units = api_quota_usage.units + excluded.units,
      calls = api_quota_usage.calls || jsonb_build_object(
        ${endpoint}::text, coalesce((api_quota_usage.calls->>${endpoint})::int, 0) + 1
      )`;
}

/**
 * Per-run quota budget. Jobs ask `budget.take(cost)` before a call; once the
 * run's allowance or the daily ceiling is reached, calls are refused instead of
 * eating the quota the next runs need.
 */
export function createBudget(units) {
  return {
    allowed: Math.max(0, Math.floor(units)),
    spent: 0,
    get left() {
      return this.allowed - this.spent;
    },
    canAfford(cost) {
      return this.spent + cost <= this.allowed;
    },
  };
}

/**
 * A slice of `parent` capped at `units`: spending counts against both, so one
 * discovery source can run out without stopping the others.
 */
export function subBudget(parent, units) {
  let spent = 0;
  return {
    allowed: Math.max(0, Math.floor(units)),
    get spent() {
      return spent;
    },
    set spent(value) {
      parent.spent += value - spent;
      spent = value;
    },
    get left() {
      return Math.min(this.allowed - spent, parent.left);
    },
    canAfford(cost) {
      return spent + cost <= this.allowed && parent.canAfford(cost);
    },
  };
}

/**
 * One Data API call. Throws QuotaExceededError when YouTube refuses for quota
 * or when the run budget cannot afford the call.
 */
export async function youtubeApi(endpoint, params, budget) {
  const cost = QUOTA_COST[endpoint] ?? 1;
  if (budget && !budget.canAfford(cost)) throw new QuotaExceededError(`Run budget exhausted before ${endpoint}.list`);
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is missing (.env)");

  const query = new URLSearchParams({ ...params, key: apiKey });
  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${API_BASE}/${endpoint}?${query}`, { signal: AbortSignal.timeout(20_000) });
    if (res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  await recordQuota(`${endpoint}.list`, cost);
  if (budget) budget.spent += cost;

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body.error?.errors?.[0]?.reason ?? `HTTP ${res.status}`;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") {
      throw new QuotaExceededError(`YouTube API ${endpoint}.list: ${reason}`);
    }
    const err = new Error(`YouTube API ${endpoint}.list: ${reason}`);
    err.reason = reason;
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

export function parseIsoDuration(iso) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "") ?? [];
  const seconds = (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
  const h = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return { seconds, formatted: h > 0 ? `${h}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}` };
}

export const chunk = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

export async function mapLimit(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** UC… channel id -> UU… uploads playlist id. */
export const uploadsPlaylistId = (channelId) => (channelId.startsWith("UC") ? `UU${channelId.slice(2)}` : null);

// Shorts are up to 3 minutes since October 2024; anything longer is never a Short.
export const SHORT_MAX_SECONDS = 180;

// ---------------------------------------------------------------------------
// Free sources
// ---------------------------------------------------------------------------

function decodeXml(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Latest 15 uploads of a channel from its public RSS feed. */
export async function fetchChannelRss(channelId) {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml,application/xml" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { status: res.status, entries: [] };
  return { status: 200, ...parseRssFeed(await res.text()) };
}

/**
 * Parses a channel's Atom feed. View counts are live (measured equal to or
 * ahead of videos.list), so the feed doubles as a free view counter.
 */
export function parseRssFeed(xml) {
  const channelName = decodeXml(xml.match(/<author>\s*<name>([\s\S]*?)<\/name>/)?.[1] ?? "");
  const entries = [];
  for (const [, block] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const publishedAt = block.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !title || !publishedAt) continue;
    const isShortLink = /href="[^"]*\/shorts\//.test(block);
    entries.push({
      id,
      title: decodeXml(title),
      description: decodeXml(block.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? ""),
      publishedAt,
      thumbnail: block.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1] ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      views: Number(block.match(/<media:statistics[^>]+views="(\d+)"/)?.[1] ?? 0),
      // The feed links Shorts to /shorts/: a reliable "yes", but no link is not a reliable "no".
      isShort: isShortLink ? true : null,
    });
  }
  return { channelName, entries };
}

/**
 * Exact Short / regular-video status from youtube.com/shorts/{id}:
 * 200 = Short, 303 redirect to /watch = regular video. Returns null when unknown.
 */
export async function probeIsShort(videoId) {
  const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
    method: "HEAD",
    redirect: "manual",
    headers: { "User-Agent": USER_AGENT, Cookie: CONSENT_COOKIE },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 200) return true;
  if (res.status === 303 || (res.status === 302 && /\/watch/.test(res.headers.get("location") ?? ""))) return false;
  if (res.status === 429) {
    const err = new Error("YouTube throttled the Shorts probe");
    err.throttled = true;
    throw err;
  }
  return null;
}

/**
 * Current thumbnail version: i.ytimg.com's ETag is the Unix time the thumbnail
 * was set ("0" for the auto-generated frame). A new value means it was changed.
 */
export async function thumbnailEtag(videoId) {
  const res = await fetch(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, {
    method: "HEAD",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.headers.get("etag")?.replace(/"/g, "") ?? null;
}

/** 320x180 picture of the current thumbnail, only if it is still version `etag`. */
export async function thumbnailImage(videoId, etag) {
  const res = await fetch(`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok || res.headers.get("etag")?.replace(/"/g, "") !== etag) return null;
  return Buffer.from(await res.arrayBuffer());
}
