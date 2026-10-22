/**
 * Users' alerts (alert_rules), every tick: records the videos each enabled rule
 * newly matches (PostgreSQL only, no YouTube quota), then sends them to the
 * rule's Discord webhook: right away ("instant"), or as a digest once a day or
 * a week. Rules without a webhook only show their matches in the app.
 */
import { sql } from "../../lib/sql.js";
import { sendDiscord } from "../../lib/discord.js";
import { VIDEO_COLUMNS } from "../../lib/videoRows.js";
import { alertDiscordPayload, alertWhere } from "../../lib/alerts.js";

// New matches recorded per rule and tick: the fastest videos first
const MAX_NEW_PER_RULE = 25;
const DIGEST_HOURS = { daily: 24, weekly: 24 * 7 };

export async function runAlerts() {
  const rules = await sql`SELECT * FROM alert_rules WHERE enabled ORDER BY last_checked_at NULLS FIRST`;
  let matched = 0;
  let sent = 0;
  let failed = 0;

  for (const rule of rules) {
    const inserted = await sql`
      INSERT INTO alert_matches (alert_id, video_id)
      SELECT ${rule.id}, v.youtube_video_id
      FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE ${alertWhere(rule, rule.user_id)}
        AND NOT EXISTS (SELECT 1 FROM alert_matches m WHERE m.alert_id = ${rule.id} AND m.video_id = v.youtube_video_id)
      ORDER BY v.views_per_hour DESC NULLS LAST
      LIMIT ${MAX_NEW_PER_RULE}
      ON CONFLICT DO NOTHING
      RETURNING video_id`;
    matched += inserted.length;
    await sql`UPDATE alert_rules SET last_checked_at = now() WHERE id = ${rule.id}`;

    if (!rule.discord_webhook) {
      await sql`UPDATE alert_matches SET notified_at = now() WHERE alert_id = ${rule.id} AND notified_at IS NULL`;
      continue;
    }
    const digestHours = DIGEST_HOURS[rule.frequency];
    if (digestHours && rule.last_sent_at && Date.now() - new Date(rule.last_sent_at).getTime() < digestHours * 3_600_000) continue;

    const pending = await sql`
      SELECT ${VIDEO_COLUMNS}
      FROM alert_matches m
      JOIN videos v ON v.youtube_video_id = m.video_id
      JOIN channels c ON c.id = v.channel_id
      WHERE m.alert_id = ${rule.id} AND m.notified_at IS NULL
      ORDER BY v.views_per_hour DESC NULLS LAST`;
    if (!pending.length) continue;

    // A failed send stays pending and is retried next tick
    const ok = await sendDiscord(rule.discord_webhook, alertDiscordPayload(rule, pending, { total: pending.length }));
    if (!ok) {
      failed++;
      continue;
    }
    await sql`UPDATE alert_matches SET notified_at = now() WHERE alert_id = ${rule.id} AND notified_at IS NULL`;
    await sql`UPDATE alert_rules SET last_sent_at = now() WHERE id = ${rule.id}`;
    sent++;
  }

  return { rules: rules.length, matched, sent, failed };
}
