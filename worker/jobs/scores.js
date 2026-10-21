/**
 * Scores, all in SQL:
 *   - baseline: median views of the channel's last N matured uploads of the same
 *     format (Shorts vs long-form), live streams excluded
 *   - outlier multiplier = views / baseline, views per hour/day, engagement
 *   - relevance score /100 for recent videos that clear the quality filters
 *   - channel trend score, outlier rate and opportunity score
 */
import { sql } from "../../lib/sql.js";
import { CONFIG } from "../config.js";

const floorFor = (isShortColumn) =>
  sql`case when ${isShortColumn} then ${CONFIG.medianFloorShort}::float8 else ${CONFIG.medianFloorLong}::float8 end`;

export async function runScores() {
  // tmp_baselines is a temp table: every statement must run on the same connection.
  const db = await sql.reserve();
  try {
    return await computeScores(db);
  } finally {
    await db`drop table if exists tmp_baselines`.catch(() => {});
    db.release();
  }
}

async function computeScores(db) {
  const stats = {};

  // Baselines: one per channel and format.
  await db`
    create temp table tmp_baselines as
    select channel_id, is_short, percentile_cont(0.5) within group (order by view_count) as med, count(*) as n
    from (
      select channel_id, is_short, view_count,
        row_number() over (partition by channel_id, is_short order by published_at desc) as rank
      from videos
      where not is_livestream
        and last_stats_at is not null
        and published_at between now() - interval '365 days' and now() - make_interval(days => ${CONFIG.baselineMinAgeDays})
    ) recent
    where rank <= ${CONFIG.baselineVideos}
    group by channel_id, is_short
    having count(*) >= ${CONFIG.baselineMinVideos}`;
  await db`create index on tmp_baselines (channel_id, is_short)`;

  await db`
    update channels c set median_views = least(b.med, 2147483647)::int
    from tmp_baselines b
    where b.channel_id = c.id and not b.is_short`;

  // Per-video metrics over the last year.
  const updated = await db`
    -- Views per hour over the last 6 hours of snapshots (API and RSS). Views only
    -- go up, so max - min over the span is robust to one late or repeated reading,
    -- where the last pair of snapshots alone can read 0.
    with vel as (
      select youtube_video_id,
        (max(view_count) - min(view_count))::float8
          / (extract(epoch from max(captured_at) - min(captured_at)) / 3600) as vph
      from video_stat_snapshots
      where captured_at > now() - interval '6 hours'
      group by youtube_video_id
      having max(captured_at) - min(captured_at) > interval '20 minutes'
    ),
    scored as (
      select
        v.youtube_video_id,
        v.view_count::float8 as views,
        v.is_short,
        v.is_livestream,
        c.subscriber_count as subs,
        vel.vph,
        b.med,
        extract(epoch from now() - v.published_at)::float8 / 3600 as age_h,
        case when b.med is not null then v.view_count::float8 / greatest(b.med, ${floorFor(sql`v.is_short`)}) end as mult,
        case when v.view_count > 0 and v.like_count is not null
          then (v.like_count + coalesce(v.comment_count, 0))::float8 / v.view_count end as engagement
      from videos v
      join channels c on c.id = v.channel_id
      left join tmp_baselines b on b.channel_id = v.channel_id and b.is_short = v.is_short
      left join vel on vel.youtube_video_id = v.youtube_video_id
      where v.published_at between now() - interval '365 days' and now()
    )
    update videos v set
      baseline_views = least(s.med, 2147483647)::int,
      views_per_day = s.views / greatest(s.age_h / 24, 1.0 / 24),
      views_per_hour = coalesce(greatest(s.vph, 0), s.views / greatest(s.age_h, 1)),
      outlier_multiplier = s.mult,
      engagement_rate = s.engagement,
      -- 35 pts multiplier (log, 30x = max) · 25 pts reach (log, 10K = 0, ~3M = max)
      -- 20 pts views/subscribers (10x = max) · 20 pts freshness (linear over 7 days)
      relevance_score = case
        when s.mult is not null
          and not s.is_livestream
          and s.age_h <= 30 * 24
          and coalesce(s.subs, 0) >= ${CONFIG.minSubscribers}
          and s.views >= case when s.is_short then ${CONFIG.minViewsShort}::float8 else ${CONFIG.minViewsLong}::float8 end
        then round((
            35 * least(1, greatest(0, log(greatest(s.mult, 1)) / log(30::float8)))
          + 25 * least(1, greatest(0, (log(greatest(s.views, 1)) - 4) / 2.5))
          + 20 * least(1, log(1 + s.views / greatest(s.subs, 1)) / log(11::float8))
          + 20 * greatest(0, 1 - s.age_h / 168)
        )::numeric, 1)
      end
    from scored s
    where s.youtube_video_id = v.youtube_video_id`;
  stats.videosScored = updated.count;

  await computeChannelTrends(db);
  await computeOpportunities(db);

  const [summary] = await db`
    select
      count(*) filter (where relevance_score is not null)::int as relevant,
      count(*) filter (where outlier_multiplier >= 3 and published_at > now() - interval '7 days')::int as outliers_7d,
      (select count(*) from tmp_baselines)::int as baselines
    from videos`;
  return { ...stats, ...summary };
}

// Channel trend score /100: how much a channel beats its own normal right now.
//   40 pts recent performance: avg multiplier of the last 14 days' uploads (log, 10x = max)
//   25 pts recent outliers: relevant >= 3x videos in 30 days (4 = max)
//   20 pts reach vs size: week's views / subscribers (3x = max)
//   15 pts growth: subscribers gained in 24 h (+0.5 % = max), or uploads until a day of history exists
async function computeChannelTrends(db) {
  // One statement: channels with no recent uploads get null in the same update.
  await db`
      with recent as (
        select
          v.channel_id,
          avg(v.view_count::float8 / greatest(b.med, ${floorFor(sql`v.is_short`)})) as ratio,
          coalesce(sum(v.view_count) filter (where v.published_at > now() - interval '7 days'), 0)::float8 as views_7d,
          count(*) filter (where v.published_at > now() - interval '7 days')::float8 as uploads_7d
        from videos v
        join tmp_baselines b on b.channel_id = v.channel_id and b.is_short = v.is_short
        where v.published_at > now() - interval '14 days' and not v.is_livestream
        group by v.channel_id
      ),
      outliers as (
        select channel_id, count(*)::float8 as n
        from videos
        where published_at > now() - interval '30 days' and relevance_score is not null and outlier_multiplier >= 3
        group by channel_id
      ),
      growth as (
        select
          youtube_channel_id,
          (array_agg(subscriber_count order by captured_at desc))[1]
            - (array_agg(subscriber_count order by captured_at desc) filter (where captured_at <= now() - interval '20 hours'))[1]
            as subs_24h
        from channel_stat_snapshots
        where captured_at > now() - interval '4 days'
        group by youtube_channel_id
      ),
      scored as (
        select ch.id as channel_id, r.ratio, r.views_7d, r.uploads_7d, coalesce(o.n, 0) as outliers, g.subs_24h
        from channels ch
        left join recent r on r.channel_id = ch.id
        left join outliers o on o.channel_id = r.channel_id
        left join growth g on g.youtube_channel_id = ch.youtube_channel_id
      )
      update channels c set
        recent_ratio = s.ratio,
        trend_score = case when s.ratio is not null and coalesce(c.subscriber_count, 0) >= ${CONFIG.minSubscribers} then round((
            40 * least(1, ln(1 + greatest(0, s.ratio - 1)) / ln(10::float8))
          + 25 * least(1, s.outliers / 4)
          + 20 * least(1, log(1 + s.views_7d / greatest(c.subscriber_count, 1)) / log(4::float8))
          + 15 * case
              when s.subs_24h is not null and c.subscriber_count > 0
                then least(1, greatest(0, s.subs_24h::float8 / c.subscriber_count * 100 / 0.5))
              else least(1, s.uploads_7d / 3)
            end
        )::numeric, 1) end
      from scored s
      where s.channel_id = c.id
        and (c.trend_score is not null or c.recent_ratio is not null or s.ratio is not null)`;
}

// Channel Finder metrics.
//   outlier_rate: share of matured uploads (3-180 days) at >= 3x the channel's normal (min 5)
//   opportunity_score /100, "could I start a channel like this?":
//     30 pts consistent hits: outlier rate (30 % = max)
//     25 pts growth speed: subscribers per day since creation (log, 1,000/day = max)
//     20 pts replicable size: 10k subs or less = max, 1M+ = 0
//     15 pts current momentum: recent uploads vs normal (x5 = max)
//     10 pts low saturation: few channels in the same niche and language
async function computeOpportunities(db) {
  await db`
    with rates as (
      select channel_id, count(*) filter (where outlier_multiplier >= 3)::float8 / count(*) as rate
      from videos
      where outlier_multiplier is not null and not is_livestream
        and published_at between now() - interval '180 days' and now() - interval '3 days'
      group by channel_id
      having count(*) >= 5
    ),
    uploads as (
      select channel_id, count(*)::float8 / 4 as per_week
      from videos
      where published_at > now() - interval '28 days'
      group by channel_id
    ),
    saturation as (
      select niche, lang, count(*)::float8 as channels
      from channels
      where niche is not null and rss_error_count < 5
      group by niche, lang
    ),
    scored as (
      select c.id, r.rate, coalesce(u.per_week, 0) as per_week, coalesce(s.channels, 0) as niche_channels
      from channels c
      left join rates r on r.channel_id = c.id
      left join uploads u on u.channel_id = c.id
      left join saturation s on s.niche = c.niche and s.lang is not distinct from c.lang
    )
    update channels c set
      uploads_per_week = s.per_week,
      outlier_rate = s.rate,
      opportunity_score = case when s.rate is not null and coalesce(c.subscriber_count, 0) >= ${CONFIG.minSubscribers} then round((
          30 * least(1, s.rate / 0.3)
        + 25 * case when c.channel_created_at is null then 0 else least(1, log(1 + c.subscriber_count::float8
            / greatest(extract(epoch from now() - c.channel_created_at) / 86400, 1)) / 3) end
        + 20 * least(1, greatest(0, (6 - log(greatest(c.subscriber_count, 1)::float8)) / 2))
        + 15 * least(1, ln(1 + greatest(0, coalesce(c.recent_ratio, 0) - 1)) / ln(5::float8))
        + 10 * (1 - least(1, s.niche_channels / 150))
      )::numeric, 1) end
    from scored s
    where s.id = c.id`;
}
