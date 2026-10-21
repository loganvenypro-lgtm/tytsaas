/**
 * Daily trending charts (videos.list chart=mostPopular, 1 unit per region ×
 * category). Every position is stored in trending_entries for the app ("trending
 * in FR today"); videos of known channels get their stats saved on the way, and
 * unknown channels become discovery candidates (vetted by the discovery job).
 * Charts barely move within a day, so once a day replaces the old 4 runs a day.
 */
import { sql } from "../../lib/sql.js";
import { youtubeApi, chunk, QuotaExceededError } from "../../lib/youtube.js";
import { CONFIG } from "../config.js";
import { saveApiVideos, VIDEO_PARTS } from "../store.js";
import { recordSpend } from "./discovery.js";

// Overall chart (0) and the categories YouTube publishes charts for; a region
// that doesn't support one just errors.
export const TRENDING_CATEGORIES = [0, 1, 2, 15, 17, 20, 22, 23, 24, 25, 26, 27, 28];

/** Units one run costs, for the quota pilot. */
export const trendingUnitsPerRun = () => CONFIG.discoveryRegions.length * TRENDING_CATEGORIES.length;

export async function runTrending({ budget }) {
  const stats = { calls: 0, errors: 0, entries: 0, videosSaved: 0, unknownChannels: 0 };
  if (budget.allowed === 0) return { ...stats, skipped: "no budget" };

  const day = new Date().toISOString().slice(0, 10);
  const items = new Map();
  const entries = [];
  try {
    for (const region of CONFIG.discoveryRegions) {
      for (const category of TRENDING_CATEGORIES) {
        let data;
        try {
          data = await youtubeApi(
            "videos",
            {
              part: VIDEO_PARTS,
              chart: "mostPopular",
              regionCode: region,
              maxResults: "50",
              ...(category ? { videoCategoryId: String(category) } : {}),
            },
            budget,
          );
        } catch (err) {
          if (err instanceof QuotaExceededError) throw err;
          stats.errors++;
          continue;
        }
        stats.calls++;
        (data.items ?? []).forEach((item, i) => {
          if (!item.snippet?.channelId) return;
          items.set(item.id, item);
          entries.push({
            day,
            region,
            category_id: category,
            rank: i + 1,
            youtube_video_id: item.id,
            youtube_channel_id: item.snippet.channelId,
            title: item.snippet.title ?? "",
            view_count: item.statistics?.viewCount != null ? Number(item.statistics.viewCount) : null,
            published_at: item.snippet.publishedAt ?? null,
            video_category_id: item.snippet.categoryId != null ? Number(item.snippet.categoryId) : null,
          });
        });
      }
    }
  } catch (err) {
    if (!(err instanceof QuotaExceededError)) throw err;
    stats.quotaExhausted = true;
  }

  for (const batch of chunk(entries, 1000)) {
    await sql`
      insert into trending_entries ${sql(batch)}
      on conflict (day, region, category_id, rank) do update set
        youtube_video_id = excluded.youtube_video_id,
        youtube_channel_id = excluded.youtube_channel_id,
        title = excluded.title,
        view_count = excluded.view_count,
        published_at = excluded.published_at,
        video_category_id = excluded.video_category_id`;
  }
  stats.entries = entries.length;
  stats.videosSaved = (await saveApiVideos([...items.values()])).saved;

  const channelIds = [...new Set(entries.map((e) => e.youtube_channel_id))];
  const known = channelIds.length
    ? new Set((await sql`select youtube_channel_id from channels where youtube_channel_id in ${sql(channelIds)}`).map((r) => r.youtube_channel_id))
    : new Set();
  stats.unknownChannels = channelIds.filter((id) => !known.has(id)).length;
  await recordSpend("trending", { units: budget.spent, candidates: stats.unknownChannels });
  return stats;
}
