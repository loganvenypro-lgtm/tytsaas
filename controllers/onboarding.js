import { sql } from "../lib/sql.js";
import { NICHE_BY_ID } from "../lib/taxonomy/index.js";
import { createBudget, youtubeApi } from "../lib/youtube.js";
import { compact, sendDiscord, stamp, truncate } from "../lib/discord.js";

const ROLES = ["creator", "agency", "brand", "aspiring"];
const ROLE_LABELS = { creator: "YouTubeur", agency: "Agence / manager", brand: "Marque / sponsor", aspiring: "Se lance" };

const num = (value) => (value != null ? Number(value) : null);

/** "https://youtube.com/@fern-tv/videos", "@fern-tv", "UC…" or a name → what to look up. */
export function parseChannelInput(raw) {
  const text = raw.trim();
  const id = text.match(/(UC[\w-]{22})/)?.[1];
  if (id) return { id };
  const handle = text.match(/@([\w.-]{3,30})/)?.[1] ?? (/^[\w.-]{3,30}$/.test(text) ? text : null);
  return { handle, name: text };
}

const channelJson = (r) => ({
  id: r.youtube_channel_id,
  name: r.name,
  handle: r.handle ?? null,
  avatar: r.thumbnail_url ?? null,
  subscribers: num(r.subscriber_count),
  videoCount: num(r.video_count),
  niche: r.niche && NICHE_BY_ID[r.niche] ? { id: r.niche, label: NICHE_BY_ID[r.niche].label } : null,
  inDatabase: true,
});

/**
 * GET /api/onboarding/channel?q=: the creator's channel from our database, else one
 * channels.list call (1 quota unit) so a channel we don't scan yet still resolves.
 */
export async function findChannel(req, res) {
  const q = typeof req.query.q === "string" ? req.query.q.slice(0, 200) : "";
  if (!q.trim()) return res.status(400).json({ error: "Lien de chaîne manquant." });
  const { id, handle, name } = parseChannelInput(q);

  const [row] = await sql`
    SELECT youtube_channel_id, name, handle, thumbnail_url, subscriber_count, video_count, niche
    FROM channels
    WHERE ${
      id
        ? sql`youtube_channel_id = ${id}`
        : sql`lower(handle) = lower(${"@" + (handle ?? "")}) OR lower(name) = lower(${name})`
    }
    ORDER BY subscriber_count DESC NULLS LAST
    LIMIT 1`;
  if (row) return res.json({ channel: channelJson(row) });

  if (!process.env.YOUTUBE_API_KEY || (!id && !handle)) return res.status(404).json({ error: "Chaîne introuvable." });
  try {
    const data = await youtubeApi(
      "channels",
      { part: "snippet,statistics", ...(id ? { id } : { forHandle: `@${handle}` }) },
      createBudget(1)
    );
    const item = data.items?.[0];
    if (!item) return res.status(404).json({ error: "Chaîne introuvable." });
    res.json({
      channel: {
        id: item.id,
        name: item.snippet.title,
        handle: item.snippet.customUrl ?? null,
        avatar: item.snippet.thumbnails?.default?.url ?? null,
        subscribers: item.statistics.hiddenSubscriberCount ? null : num(item.statistics.subscriberCount),
        videoCount: num(item.statistics.videoCount),
        niche: null,
        inDatabase: false,
      },
    });
  } catch (err) {
    console.error("[onboarding] channel lookup:", err.message);
    res.status(404).json({ error: "Chaîne introuvable." });
  }
}

/** GET /api/onboarding/niche/:niche: the biggest active channels of a niche, for creators without a channel. */
export async function nicheChannels(req, res) {
  const { niche } = req.params;
  if (!NICHE_BY_ID[niche]) return res.status(404).json({ error: "Niche inconnue." });
  const rows = await sql`
    SELECT youtube_channel_id, name, handle, thumbnail_url, subscriber_count
    FROM channels
    WHERE niche = ${niche} AND rss_error_count < 5 AND COALESCE(subscriber_count, 0) >= 1000
    ORDER BY COALESCE(opportunity_score, 0) * ln(COALESCE(subscriber_count, 0) + 1) DESC
    LIMIT 12`;
  res.json({
    items: rows.map((r) => ({
      id: r.youtube_channel_id,
      name: r.name,
      handle: r.handle ?? null,
      avatar: r.thumbnail_url ?? null,
      subscribers: num(r.subscriber_count),
    })),
  });
}

const str = (value, max) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);

/** Competitors picked at onboarding, as the client sent them: { id, name, avatar, subscribers }. */
function parseCompetitors(list) {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 20)
    .map((c) => ({
      id: str(c?.id, 64),
      name: str(c?.name, 120),
      avatar: str(c?.avatar, 500),
      subscribers: Number.isFinite(c?.subscribers) ? c.subscribers : null,
    }))
    .filter((c) => c.id && c.name);
}

/**
 * POST /api/onboarding: saves the answers on the account (they drive the home page),
 * keeps a trace for the admin tab and posts them to DISCORD_ONBOARDING_WEBHOOK_URL.
 * A skipped onboarding is recorded the same way, with whatever was answered.
 */
export async function complete(req, res) {
  const body = req.body ?? {};
  const role = ROLES.includes(body.role) ? body.role : null;
  const skipped = body.skipped === true;
  const niche = NICHE_BY_ID[body.niche] ? body.niche : null;
  const channel = body.channel && str(body.channel.id, 64) ? { ...body.channel, id: str(body.channel.id, 64) } : null;
  const competitors = parseCompetitors(body.competitors);
  const input = str(body.input, 200);
  const durationMs = Number.isFinite(body.durationMs) ? Math.round(body.durationMs) : null;

  await sql`
    UPDATE "user" SET
      onboarded_at = now(),
      onboarding_role = ${role},
      youtube_channel_id = COALESCE(${role === "brand" ? null : (channel?.id ?? null)}, youtube_channel_id),
      competitor_channel_ids = CASE WHEN ${competitors.length} > 0 THEN ${competitors.map((c) => c.id)}::text[] ELSE competitor_channel_ids END
    WHERE id = ${req.user.id}`;

  const reference = channel
    ? {
        id: channel.id,
        title: str(channel.name, 120) ?? channel.id,
        handle: str(channel.handle, 60),
        avatar: str(channel.avatar, 500),
        subscriberCount: Number.isFinite(channel.subscribers) ? channel.subscribers : 0,
        archetypeLabel: niche ? NICHE_BY_ID[niche].label.fr : "—",
        editorialTags: [],
      }
    : null;
  await sql`
    INSERT INTO onboarding_analyses (user_id, input_channel, niche, role, reference, competitors, insights, error, duration_ms)
    VALUES (${req.user.id}, ${input}, ${niche}, ${role}, ${reference ? sql.json(reference) : null},
            ${sql.json(competitors.map((c) => ({ id: c.id, title: c.name, avatar: c.avatar, subscriberCount: c.subscribers ?? 0, similarityScore: 0, archetypeLabel: "" })))},
            null, ${skipped ? "Onboarding passé" : null}, ${durationMs})`;

  // Never blocks the user: Discord being down must not keep them out of the app
  sendDiscord(process.env.DISCORD_ONBOARDING_WEBHOOK_URL, {
    username: "TYT Onboarding",
    embeds: [onboardingEmbed({ user: req.user, role, skipped, channel, input, niche, competitors, durationMs })],
  }).catch(() => {});

  res.json({ ok: true });
}

function onboardingEmbed({ user, role, skipped, channel, input, niche, competitors, durationMs }) {
  const channelText = channel
    ? `[${truncate(String(channel.name ?? channel.id), 80)}](https://youtube.com/channel/${channel.id})` +
      (Number.isFinite(channel.subscribers) ? ` · ${compact(channel.subscribers)} abonnés` : "")
    : input
      ? `${truncate(input, 80)} (non trouvée)`
      : "Pas de chaîne";
  const fields = [
    { name: "Profil", value: role ? ROLE_LABELS[role] : "—", inline: true },
    { name: "Niche", value: niche ? NICHE_BY_ID[niche].label.fr : "—", inline: true },
    { name: "Chaîne", value: channelText },
    {
      name: `Chaînes suivies (${competitors.length})`,
      value: competitors.length ? truncate(competitors.map((c) => c.name).join(", "), 1000) : "Aucune",
    },
  ];
  if (durationMs != null) fields.push({ name: "Durée", value: `${Math.max(1, Math.round(durationMs / 1000))} s`, inline: true });
  return {
    title: skipped ? "Onboarding passé" : "Onboarding terminé",
    description: `**${truncate(user.name || "Sans nom", 80)}** · ${user.email}\nInscrit ${stamp(user.createdAt)}`,
    color: skipped ? 0x94a3b8 : 0x3b82f6,
    fields,
    timestamp: new Date().toISOString(),
  };
}
