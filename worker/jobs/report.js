/**
 * Discord reports (DISCORD_WEBHOOK_URL), run at the end of every tick:
 *   - outliers: relevant videos < 48 h posted once per tier (3x, then 10x, then
 *     25x as they keep climbing), one per channel, long-form and Shorts apart
 *   - alerts: a job failed, YouTube throttled RSS, the day's quota ran out;
 *     sent once when the problem appears, not every tick it lasts
 *   - daily: data growth vs the previous daily report, the day's activity and
 *     quota, discovery ROI per source, newly eligible channels, today's trending
 */
import { sql } from "../../lib/sql.js";
import { sendDiscord, fmt, compact, truncate, stamp, delta, outlierTier, onePerChannel } from "../../lib/discord.js";
import { nicheLabel, formatLabel } from "../../lib/classifier.js";
import { CATEGORIES, HOOK_BY_ID } from "../../lib/taxonomy/index.js";
import { YPP_STATUSES } from "../../lib/taxonomy/monetization.js";
import { CONFIG } from "../config.js";
import { sourceRoi } from "./discovery.js";

export async function runReport({ previous, tick }) {
  if (!CONFIG.discordWebhook && !CONFIG.discordAlertsWebhook) return { skipped: "no DISCORD_WEBHOOK_URL" };
  const stats = { outliers: 0, alerts: 0, daily: false };

  const alertKeys = currentAlerts(tick);
  const known = new Set(previous?.alertKeys ?? []);
  const fresh = alertKeys.filter((a) => !known.has(a.key));
  if (fresh.length && (await sendAlerts(fresh, tick))) stats.alerts = fresh.length;
  stats.alertKeys = alertKeys.map((a) => a.key);

  if (CONFIG.discordWebhook) {
    stats.outliers = await sendOutliers();
    stats.daily = await maybeSendDaily();
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

function currentAlerts(tick) {
  const alerts = [];
  for (const [name, result] of Object.entries(tick?.jobs ?? {})) {
    if (result.error) alerts.push({ key: `failed:${name}`, text: `❌ Job **${name}** en échec : ${truncate(result.error, 300)}` });
  }
  const rss = tick?.jobs?.rss;
  if (rss?.rateLimited || rss?.skipped) {
    alerts.push({
      key: "rss:throttled",
      text: `⏸️ YouTube limite le RSS${rss.outage ? " (404 partout : panne côté YouTube)" : ""}. Reprise vers ${
        rss.backoffUntil ? stamp(rss.backoffUntil, "t") : "?"
      }, repli API sur ${fmt(rss.fallback?.ok ?? 0)} chaînes.`,
    });
  }
  if (Object.values(tick?.jobs ?? {}).some((r) => r.quotaExhausted) && tick?.quota) {
    alerts.push({
      key: "quota:exhausted",
      text: `🔋 Budget quota du jour atteint (${fmt(tick.quota.usedBefore + (tick.quota.usedThisTick ?? 0))} / ${fmt(tick.quota.dailyBudget)} unités).`,
    });
  }
  if (tick?.pilot?.saturated) {
    alerts.push({
      key: "pilot:saturated",
      text: `📉 Les rafraîchissements demandent ${fmt(tick.pilot.demand.total + tick.pilot.fixedUnits)} unités/jour sur ${fmt(tick.quota.dailyBudget)} : découverte en pause, backfill ralenti.`,
    });
  }
  return alerts;
}

async function sendAlerts(alerts, tick) {
  return sendDiscord(CONFIG.discordAlertsWebhook, {
    embeds: [
      {
        title: "⚠️ Worker YouTube",
        description: alerts.map((a) => a.text).join("\n"),
        color: alerts.some((a) => a.key.startsWith("failed:")) ? 0xef4444 : 0xf59e0b,
        footer: { text: `Tick #${tick?.runId ?? "?"}` },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Outliers
// ---------------------------------------------------------------------------

async function sendOutliers() {
  const candidates = await sql`
    select
      v.youtube_video_id, v.title, v.view_count, v.like_count, v.comment_count, v.outlier_multiplier, v.baseline_views,
      v.views_per_hour, v.is_short, v.duration_formatted, v.published_at, v.category_id, v.lang, v.niche, v.format,
      v.title_hooks, v.relevance_score, v.thumbnail_url, v.engagement_rate, v.discord_tier,
      v.thumbnail_variants, v.title_variants,
      c.name as channel, c.youtube_channel_id, c.subscriber_count, c.thumbnail_url as channel_thumb, c.country
    from videos v
    join channels c on c.id = v.channel_id
    where v.relevance_score >= ${CONFIG.discordMinScore}
      and v.published_at > now() - make_interval(hours => ${CONFIG.discordWindowHours})
      and v.outlier_multiplier >= 3
      and coalesce(v.discord_tier, 0) < case
        when v.outlier_multiplier >= 25 then 3 when v.outlier_multiplier >= 10 then 2 else 1 end
    order by v.relevance_score desc
    limit 200`;

  let sent = 0;
  for (const [isShort, heading] of [
    [false, "🎬 Nouveaux outliers · vidéos longues"],
    [true, "📱 Nouveaux outliers · Shorts"],
  ]) {
    const videos = onePerChannel(candidates.filter((v) => v.is_short === isShort), CONFIG.discordMaxPerReport);
    if (!videos.length) continue;
    const ok = await sendDiscord(CONFIG.discordWebhook, {
      content: `## ${heading}`,
      embeds: videos.map(videoEmbed),
    });
    if (!ok) continue;
    for (const v of videos) {
      await sql`
        update videos set discord_tier = ${outlierTier(v.outlier_multiplier)}, discord_reported_at = now()
        where youtube_video_id = ${v.youtube_video_id}`;
    }
    sent += videos.length;
  }
  return sent;
}

function videoEmbed(v) {
  const views = Number(v.view_count);
  const subs = v.subscriber_count;
  const multiplier = Number(v.outlier_multiplier);
  const tier = outlierTier(multiplier);
  const score = Number(v.relevance_score);
  const climbed = v.discord_tier ? ` · ↗️ palier ${["", "3x", "10x", "25x"][tier]} atteint` : "";
  const meta = [
    `${v.is_short ? "📱 Short" : "🎬 Vidéo longue"}${v.duration_formatted ? ` · ${v.duration_formatted}` : ""}`,
    v.niche && `🏷️ ${nicheLabel(v.niche)}`,
    v.format && formatLabel(v.format),
    !v.niche && CATEGORIES[v.category_id]?.fr,
    v.lang && `🗣️ ${v.lang.toUpperCase()}`,
    v.country && `📍 ${v.country}`,
  ].filter(Boolean);
  const hooks = (v.title_hooks ?? []).map((h) => HOOK_BY_ID[h]?.label.fr).filter(Boolean);
  const abTest = [
    v.thumbnail_variants > 1 && `${v.thumbnail_variants} miniatures`,
    v.title_variants > 1 && `${v.title_variants} titres`,
  ].filter(Boolean);

  return {
    author: {
      name: `${v.channel} · ${subs != null ? `${compact(subs)} abonnés` : "abonnés masqués"}`,
      url: `https://www.youtube.com/channel/${v.youtube_channel_id}`,
      ...(v.channel_thumb ? { icon_url: v.channel_thumb } : {}),
    },
    title: truncate(v.title, 256),
    url: `https://youtu.be/${v.youtube_video_id}`,
    description: truncate(
      [meta.join("  ·  ") + climbed, hooks.length && `🪝 ${hooks.join(", ")}`, abTest.length && `🧪 Test A/B : ${abTest.join(" · ")}`]
        .filter(Boolean)
        .join("\n"),
      1000,
    ),
    color: tier >= 3 ? 0xef4444 : tier === 2 ? 0xf97316 : 0xeab308,
    thumbnail: { url: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg` },
    fields: [
      { name: "⭐ Score", value: `**${score.toFixed(0)}**/100`, inline: true },
      {
        name: "🔥 Outlier",
        value: `**${multiplier.toFixed(1)}x** la normale\n(${compact(v.baseline_views ?? views / multiplier)} vues habituelles)`,
        inline: true,
      },
      { name: "📅 Publiée", value: `${stamp(v.published_at)}`, inline: true },
      { name: "👁️ Vues", value: `**${fmt(views)}**`, inline: true },
      { name: "⚡ Vitesse", value: `${compact(v.views_per_hour)} vues/h`, inline: true },
      { name: "👥 Vues / abonnés", value: subs ? `${(views / subs).toFixed(1)}x` : "—", inline: true },
      {
        name: "📈 Engagement",
        value: v.engagement_rate != null ? `${(Number(v.engagement_rate) * 100).toFixed(1)} %` : "—",
        inline: true,
      },
      { name: "👍 Likes", value: v.like_count != null ? fmt(v.like_count) : "masqués", inline: true },
      { name: "💬 Commentaires", value: v.comment_count != null ? fmt(v.comment_count) : "désactivés", inline: true },
    ],
  };
}

// ---------------------------------------------------------------------------
// Daily report
// ---------------------------------------------------------------------------

async function maybeSendDaily() {
  const [due] = await sql`
    select
      extract(hour from now() at time zone 'Europe/Paris')::int >= ${CONFIG.discordDailyHour}
      and not exists (
        select 1 from discord_reports
        where kind = 'daily' and (sent_at at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
      ) as due`;
  if (!due.due) return false;
  return sendDailyReport();
}

export async function collectTotals() {
  const [totals] = await sql`
    select
      (select count(*) from videos)::int as videos,
      (select count(*) from videos where is_short)::int as shorts,
      (select count(*) from channels where rss_error_count < 5)::int as channels,
      (select count(*) from channels where discovered_via is not null)::int as discovered,
      (select count(*) from videos where last_stats_at > now() - interval '24 hours')::int as fresh_stats,
      (select count(*) from videos where rss_views_at > now() - interval '24 hours')::int as rss_views,
      (select count(*) from video_stat_snapshots)::int as snapshots,
      (select count(*) from videos where classifier_version is not null and niche is not null)::int as with_niche,
      (select count(*) from videos where relevance_score is not null)::int as relevant,
      (select count(*) from videos where relevance_score is not null and outlier_multiplier >= 3
         and published_at > now() - interval '7 days')::int as outliers_7d,
      (select count(*) from videos where thumbnail_variants > 1 or title_variants > 1)::int as ab_tests,
      (select count(*) from channels where ypp_status = 'eligible')::int as ypp_eligible`;
  return totals;
}

/** Sends the daily report now. `record: false` for the admin test (doesn't move the deltas' baseline). */
export async function sendDailyReport({ record = true } = {}) {
  const [last] = await sql`select sent_at, totals from discord_reports where kind = 'daily' order by sent_at desc limit 1`;
  const now = await collectTotals();
  const prev = last?.totals;
  const since = last?.sent_at ?? new Date(Date.now() - 86_400_000);

  const [activity] = await sql`
    select
      count(*)::int as ticks,
      count(*) filter (where status = 'failed')::int as failed,
      coalesce(sum((stats->'jobs'->'rss'->>'ok')::int), 0)::int as rss_reads,
      coalesce(sum((stats->'jobs'->'rss'->>'newVideos')::int), 0)::int as new_videos,
      coalesce(sum((stats->'jobs'->'rss'->>'snapshots')::int), 0)::int as rss_snapshots,
      coalesce(sum((stats->'jobs'->'rss'->>'titleChanges')::int), 0)::int as title_changes,
      coalesce(sum((stats->'jobs'->'videos'->>'refreshed')::int), 0)::int as videos_refreshed,
      coalesce(sum((stats->'jobs'->'abtests'->>'newVariants')::int), 0)::int as thumb_changes,
      coalesce(sum((stats->'jobs'->'discovery'->>'added')::int), 0)::int as channels_added,
      coalesce(sum((stats->'quota'->>'usedThisTick')::int), 0)::int as quota
    from scan_runs
    where started_at > ${since}`;
  const [lastTick] = await sql`select stats from scan_runs where status <> 'running' order by id desc limit 1`;
  const pilot = lastTick?.stats?.pilot;
  const roi = await sourceRoi();
  const eligible = await sql`
    select c.name, c.youtube_channel_id, c.subscriber_count, c.ypp_watch_hours, c.ypp_shorts_views, e.status
    from channel_monetization_events e
    join channels c on c.id = e.channel_id
    where e.detected_at > ${since} and e.status in ('eligible', 'early') and e.status is distinct from e.previous_status
    order by e.detected_at desc
    limit 8`;
  const trending = await sql`
    select t.region, t.title, t.youtube_video_id, t.view_count, c.name as channel
    from trending_entries t
    left join channels c on c.youtube_channel_id = t.youtube_channel_id
    where t.day = (select max(day) from trending_entries) and t.category_id = 0 and t.rank = 1
    order by t.region`;

  const line = (label, key) => `${label} : **${fmt(now[key])}**${delta(now[key], prev?.[key])}`;
  const hours = Math.round((Date.now() - new Date(since).getTime()) / 3_600_000);
  const fields = [
    {
      name: "🎞️ Données",
      value: [
        line("Vidéos", "videos"),
        line("dont Shorts", "shorts"),
        line("Chaînes actives", "channels"),
        line("Découvertes auto", "discovered"),
      ].join("\n"),
      inline: true,
    },
    {
      name: "🎯 Qualité",
      value: [
        line("Stats API < 24 h", "fresh_stats"),
        line("Vues RSS < 24 h", "rss_views"),
        line("Vidéos avec niche", "with_niche"),
        line("Outliers ≥ 3x (7 j)", "outliers_7d"),
        line("Tests A/B", "ab_tests"),
        line("Chaînes éligibles YPP", "ypp_eligible"),
      ].join("\n"),
      inline: true,
    },
    {
      name: `⚙️ Activité (${hours} h)`,
      value: [
        `Ticks : **${fmt(activity.ticks)}**${activity.failed ? ` (dont ${activity.failed} en échec)` : ""}`,
        `Flux RSS lus : **${fmt(activity.rss_reads)}** · ${fmt(activity.rss_snapshots)} relevés de vues gratuits`,
        `Nouvelles vidéos : **${fmt(activity.new_videos)}** · chaînes ajoutées : **${fmt(activity.channels_added)}**`,
        `Stats rafraîchies : **${fmt(activity.videos_refreshed)}**`,
        `Changements détectés : ${fmt(activity.title_changes)} titres · ${fmt(activity.thumb_changes)} miniatures`,
        `Quota consommé : **${fmt(activity.quota)}** unités`,
        pilot &&
          `Besoin projeté : ${fmt(pilot.demand.total + (pilot.fixedUnits ?? 0))} unités/jour pour ${fmt(pilot.demand.activeChannels)} chaînes (marge ${fmt(pilot.headroom)})`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      name: `🧭 ROI de la découverte (${CONFIG.discoveryRoiDays} j)`,
      value: roi
        .map(
          (r) =>
            `**${r.source}** : ${fmt(r.added)} chaînes, ${fmt(r.useful)} utiles pour ${fmt(r.units)} unités → ${r.perHundredUnits.toFixed(1)} / 100 u.`,
        )
        .join("\n"),
    },
  ];
  if (eligible.length) {
    fields.push({
      name: "💰 Nouvellement éligibles (estimation)",
      value: truncate(
        eligible
          .map(
            (c) =>
              `[${truncate(c.name, 40)}](https://www.youtube.com/channel/${c.youtube_channel_id}) · ${compact(c.subscriber_count)} abonnés · ${fmt(c.ypp_watch_hours)} h${
                Number(c.ypp_shorts_views) > 0 ? ` · ${compact(c.ypp_shorts_views)} vues Shorts` : ""
              } · ${YPP_STATUSES[c.status]?.fr}`,
          )
          .join("\n"),
        1024,
      ),
    });
  }
  if (trending.length) {
    fields.push({
      name: "📈 N°1 des tendances aujourd'hui",
      value: truncate(
        trending
          .map((t) => `${t.region} · [${truncate(t.title, 60)}](https://youtu.be/${t.youtube_video_id})${t.channel ? ` (${t.channel})` : ""}`)
          .join("\n"),
        1024,
      ),
    });
  }

  const ok = await sendDiscord(CONFIG.discordWebhook, {
    embeds: [
      {
        title: record ? "📊 Rapport quotidien de la data" : "📊 Rapport quotidien (test)",
        description: last ? `Comparé au rapport du ${stamp(last.sent_at, "f")}` : "Premier rapport : les suivants montreront l'évolution.",
        color: 0x6366f1,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  });
  if (ok && record) await sql`insert into discord_reports (kind, totals) values ('daily', ${sql.json(now)})`;
  return ok;
}
