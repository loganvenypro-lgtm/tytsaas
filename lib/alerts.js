// Alerts: validation of a rule, and the SQL that finds its videos
// (controllers/alerts.js for the preview, worker/jobs/alerts.js for the matches).
import { sql } from "./sql.js";
import { applyFilters } from "./filterSpec.js";
import { VIDEO_SPEC } from "../controllers/videos.js";
import { compact, stamp, truncate } from "./discord.js";

export const ALERT_NAME_MAX = 80;
export const SOURCES = ["all", "competitors", "inspirations"];
export const FREQUENCIES = ["instant", "daily", "weekly"];
/** Alerts look at videos published in the last WINDOW_DAYS days. */
export const WINDOW_DAYS = 7;

/** Top Videos params a rule may store (validated again by applyFilters on use). */
const FILTER_KEYS = [
  "q", "format", "niche", "subNiche", "style", "hooks", "language",
  "minSubs", "maxSubs", "minViews", "minMultiplier", "minVph", "relevant",
];
// At least one of these (or a competitors / inspirations source), so a rule never matches the whole database
const NARROWING_KEYS = ["q", "niche", "subNiche", "style", "hooks", "minViews", "minMultiplier", "minVph"];

const WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d{5,30}\/[\w-]{20,100}$/;

/** A Discord webhook URL, null to remove it, undefined when invalid. */
export function parseWebhook(raw) {
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const url = raw.trim();
  return WEBHOOK.test(url) ? url : undefined;
}

/** "…/abcd": enough to recognise a webhook without showing its token. */
export const maskWebhook = (url) => (url ? `…${url.slice(-6)}` : null);

/** Only the known filter keys, as short strings; empty values dropped. */
export function parseFilters(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const filters = {};
  for (const key of FILTER_KEYS) {
    const value = raw[key];
    if (value == null || value === "" || value === "all") continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") continue;
    filters[key] = String(value).trim().slice(0, 200);
    if (!filters[key]) delete filters[key];
  }
  return filters;
}

/**
 * A rule sent by the client. With `partial` (edits) every field is optional.
 * Returns `{ rule }` or `{ error }` (French, shown as is).
 */
export function parseRule(raw, { partial = false } = {}) {
  if (!raw || typeof raw !== "object") return { error: "Alerte invalide." };
  const rule = {};

  if (raw.name !== undefined || !partial) {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!name || name.length > ALERT_NAME_MAX) return { error: `Le nom doit faire entre 1 et ${ALERT_NAME_MAX} caractères.` };
    rule.name = name;
  }
  if (raw.filters !== undefined || !partial) rule.filters = parseFilters(raw.filters);
  if (raw.source !== undefined || !partial) {
    const source = raw.source ?? "all";
    if (!SOURCES.includes(source)) return { error: "Source invalide." };
    rule.source = source;
  }
  if (raw.frequency !== undefined || !partial) {
    const frequency = raw.frequency ?? "instant";
    if (!FREQUENCIES.includes(frequency)) return { error: "Fréquence invalide." };
    rule.frequency = frequency;
  }
  if (raw.discordWebhook !== undefined) {
    const webhook = parseWebhook(raw.discordWebhook);
    if (webhook === undefined) return { error: "Le webhook Discord doit être une URL https://discord.com/api/webhooks/…" };
    rule.discordWebhook = webhook;
  }
  if (raw.enabled !== undefined) {
    if (typeof raw.enabled !== "boolean") return { error: "Alerte invalide." };
    rule.enabled = raw.enabled;
  }
  return { rule };
}

/** Whether a rule narrows the videos enough to be useful (and not spam). */
export function isNarrow({ filters = {}, source = "all" }) {
  return source !== "all" || NARROWING_KEYS.some((key) => filters[key] != null && filters[key] !== "");
}

/**
 * WHERE clause for a rule's videos, on `videos v JOIN channels c`: its filters
 * (quality outliers off unless asked, no livestreams) over the last WINDOW_DAYS
 * days, from the user's competitors or inspirations when the source says so.
 */
export function alertWhere({ filters = {}, source = "all" }, userId) {
  const { where } = applyFilters(VIDEO_SPEC, {
    ...filters,
    format: filters.format ?? "all",
    excludeIndia: filters.excludeIndia ?? "false",
    excludeMusic: filters.excludeMusic ?? "false",
    period: "all",
    relevant: filters.relevant ?? "false",
    includeLive: "false",
  });
  const sourceWhere =
    source === "competitors"
      ? sql`c.youtube_channel_id = ANY(coalesce((SELECT competitor_channel_ids FROM "user" WHERE id = ${userId}), '{}'))`
      : source === "inspirations"
        ? sql`EXISTS (SELECT 1 FROM inspiration_channels f
            WHERE f.user_id = ${userId} AND f.organization_id IS NULL AND f.kind = 'inspiration'
              AND f.channel_id = c.youtube_channel_id)`
        : sql`true`;
  return sql`${where} AND v.published_at > now() - make_interval(days => ${WINDOW_DAYS}) AND ${sourceWhere}`;
}

// The app's public URL (Better Auth's base URL is the frontend's)
const APP_URL = (process.env.BETTER_AUTH_URL || "").replace(/\/$/, "");

/** One video of a match, from `videos v JOIN channels c` (see MATCH_COLUMNS in the alerts job). */
function videoEmbed(v) {
  const multiplier = v.outlier_multiplier != null ? Number(v.outlier_multiplier) : null;
  return {
    author: {
      name: `${v.channel_name} · ${v.subscriber_count != null ? `${compact(v.subscriber_count)} abonnés` : "abonnés masqués"}`,
      url: `https://www.youtube.com/channel/${v.youtube_channel_id}`,
      ...(v.channel_avatar ? { icon_url: v.channel_avatar } : {}),
    },
    title: truncate(v.title, 256),
    url: `https://youtu.be/${v.youtube_video_id}`,
    color: multiplier >= 10 ? 0xef4444 : multiplier >= 3 ? 0xf97316 : 0x22c55e,
    thumbnail: { url: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg` },
    fields: [
      { name: "👀 Vues", value: `**${compact(v.view_count)}**`, inline: true },
      { name: "⚡ Vues / heure", value: v.views_per_hour != null ? `**${compact(v.views_per_hour)}**` : "—", inline: true },
      { name: "🔥 Outlier", value: multiplier != null ? `**${multiplier.toFixed(1)}x** la normale` : "—", inline: true },
      { name: "📅 Publiée", value: stamp(v.published_at), inline: true },
    ],
  };
}

/** Discord message for an alert's new videos (at most 10 embeds, best first). */
export function alertDiscordPayload(rule, videos, { total = videos.length, test = false } = {}) {
  const shown = videos.slice(0, 10);
  const more = total > shown.length ? `\n+${total - shown.length} autres dans l'app` : "";
  const link = APP_URL ? `\n${APP_URL}/alerts` : "";
  const heading = test
    ? `## 🔔 Test de l'alerte « ${rule.name} »\nVoici à quoi ressembleront ses messages.`
    : `## 🔔 ${rule.name} · ${total} nouvelle${total > 1 ? "s" : ""} vidéo${total > 1 ? "s" : ""}`;
  return { username: "Returbe", content: truncate(`${heading}${more}${link}`, 1900), embeds: shown.map(videoEmbed) };
}
