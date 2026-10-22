/**
 * Discord webhooks: one POST per message, retried once after a 429.
 * Formatting helpers are shared by the worker's reports and the admin test.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Posts a message; returns true when Discord accepted it. Never throws. */
export async function sendDiscord(webhook, payload) {
  if (!webhook) return false;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res;
    try {
      res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "TYT Scanner", ...payload }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      console.error("Discord:", err.message);
      return false;
    }
    if (res.ok) return true;
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      await sleep(Math.ceil((body.retry_after ?? 2) * 1000));
      continue;
    }
    console.error("Discord:", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return false;
}

/**
 * Adds a Discord user to DISCORD_GUILD_ID with their OAuth token (scope guilds.join).
 * The bot behind DISCORD_BOT_TOKEN must be in that server with "Create Invite".
 * Already a member is a no-op. Never throws: sign-in must not fail because of it.
 */
export async function joinDiscordGuild(discordUserId, accessToken) {
  const { DISCORD_BOT_TOKEN: botToken, DISCORD_GUILD_ID: guildId } = process.env;
  if (!botToken || !guildId || !accessToken) return false;
  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return true;
    console.error("Discord guild join:", res.status, (await res.text()).slice(0, 300));
  } catch (err) {
    console.error("Discord guild join:", err.message);
  }
  return false;
}

export const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n ?? 0)));
export const compact = (n) =>
  new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(Math.round(Number(n ?? 0)));
export const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
/** Discord timestamp markup (rendered in each reader's time zone). */
export const stamp = (date, style = "R") => `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;

/** "+1 234 (+5,2 %)" against a previous value. */
export function delta(current, previous) {
  if (previous == null) return "";
  const diff = Number(current) - Number(previous);
  const sign = diff >= 0 ? "+" : "−";
  const pct = previous > 0 ? ` · ${sign}${Math.abs((diff / previous) * 100).toFixed(1)} %` : "";
  return ` (${sign}${fmt(Math.abs(diff))}${pct})`;
}

/** Outlier tier for re-alerts as a video keeps climbing: 1 = 3x, 2 = 10x, 3 = 25x. */
export function outlierTier(multiplier) {
  const m = Number(multiplier ?? 0);
  return m >= 25 ? 3 : m >= 10 ? 2 : m >= 3 ? 1 : 0;
}

/** Keeps the best video of each channel, then at most `max` videos. Input sorted best first. */
export function onePerChannel(videos, max, channelKey = (v) => v.youtube_channel_id) {
  const seen = new Set();
  return videos.filter((v) => !seen.has(channelKey(v)) && seen.add(channelKey(v))).slice(0, max);
}
