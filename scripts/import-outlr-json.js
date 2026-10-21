// One-time import of the data that only lived in Outlr's JSON stores (data/*.json)
// into PostgreSQL. Run `npm run db:migrate` first (schema/004_outlr_json_data.sql).
// - intelligence_database.json: missing channels and videos, channel/video stat
//   history, channel DNA and the competitor graph
// - thumbnail_intelligence_db.json: title/thumbnail versions (video_variants) and A/B verdicts
// - sponsor_database.json: brands, sponsored videos, sponsorships, outlier alerts
// Everything else in data/ (viral index, discovery caches, logs) is already in the
// scanner tables or was a disposable cache. Safe to re-run: existing rows are kept.
//
// Usage: npm run import:outlr-json [-- --dir path/to/data]
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "../lib/sql.js";

const dirFlag = process.argv.indexOf("--dir");
const DATA_DIR = dirFlag > -1 ? process.argv[dirFlag + 1] : "data";
const read = (file) => JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8"));

const intel = read("intelligence_database.json");
const thumbs = read("thumbnail_intelligence_db.json");
const sponsors = read("sponsor_database.json");

const date = (value) => (value ? new Date(value) : null);
const orNull = (value) => (value === "" || value === undefined ? null : value);

/** Rows unique on `key`, keeping the first one seen (primary keys must not repeat inside one insert). */
function uniqueBy(rows, key) {
  const seen = new Map();
  for (const row of rows) if (!seen.has(key(row))) seen.set(key(row), row);
  return [...seen.values()];
}

/** Inserts in chunks (Postgres caps bind parameters) and returns how many rows were new. */
async function insert(tx, table, rows, conflict = sql`on conflict do nothing`) {
  let added = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const result = await tx`insert into ${sql(table)} ${sql(rows.slice(i, i + 1000))} ${conflict}`;
    added += result.count;
  }
  return added;
}

const report = {};

await sql.begin(async (tx) => {
  /* ---------------------------------------------------------- channels and videos */

  const channels = Object.values(intel.channels).map((c) => ({
    id: `ch-${c.id}`,
    youtube_channel_id: c.id,
    name: c.name,
    handle: orNull(c.handle),
    thumbnail_url: orNull(c.thumbnailUrl ?? c.avatarUrl),
    subscriber_count: c.subscriberCount ?? 0,
    total_views: c.totalViews ?? 0,
    video_count: c.videoCount ?? 0,
    discovered_via: "outlr_json",
    discovered_at: date(c.lastVideoDiscovery ?? c.lastAnalyzedDate),
  }));
  report.channels = [await insert(tx, "channels", channels), channels.length];

  // Videos point to channels by their internal id, which existing rows may not build as "ch-<youtube id>"
  const ids = [...new Set(Object.values(intel.videos).map((v) => v.channelId))];
  const channelIds = new Map(
    (await tx`select id, youtube_channel_id from channels where youtube_channel_id = any(${ids})`).map((r) => [r.youtube_channel_id, r.id]),
  );
  const videos = Object.values(intel.videos)
    .filter((v) => channelIds.has(v.channelId))
    .map((v) => ({
      id: `vid-${v.id}`,
      youtube_video_id: v.id,
      channel_id: channelIds.get(v.channelId),
      title: v.title,
      description: orNull(v.description),
      thumbnail_url: orNull(v.thumbnailUrl),
      published_at: date(v.publishedAt),
      view_count: v.viewCount ?? 0,
      like_count: v.likeCount ?? 0,
      comment_count: v.commentCount ?? 0,
      duration_formatted: orNull(v.durationFormatted),
      duration_seconds: v.durationSeconds ?? 0,
      is_short: Boolean(v.isShort),
      outlier_multiplier: v.outlierMultiplier ?? 1,
      views_per_day: v.viewsPerDay ?? 0,
    }));
  report.videos = [await insert(tx, "videos", videos), Object.keys(intel.videos).length];

  /* ---------------------------------------------------------- stat history */

  const channelSnapshots = uniqueBy(
    intel.channelSnapshots.map((s) => ({
      youtube_channel_id: s.channelId,
      captured_at: date(s.timestamp),
      subscriber_count: s.subscriberCount ?? null,
      total_views: s.totalViews ?? 0,
      video_count: s.videoCount ?? null,
    })),
    (s) => `${s.youtube_channel_id}|${s.captured_at.toISOString()}`,
  );
  report.channelSnapshots = [await insert(tx, "channel_stat_snapshots", channelSnapshots), intel.channelSnapshots.length];

  const videoSnapshots = uniqueBy(
    intel.videoSnapshots.map((s) => ({
      youtube_video_id: s.videoId,
      captured_at: date(s.timestamp),
      view_count: s.viewCount ?? 0,
      like_count: s.likeCount ?? null,
      comment_count: s.commentCount ?? null,
    })),
    (s) => `${s.youtube_video_id}|${s.captured_at.toISOString()}`,
  );
  report.videoSnapshots = [await insert(tx, "video_stat_snapshots", videoSnapshots), intel.videoSnapshots.length];

  /* ---------------------------------------------------------- channel DNA and competitor graph */

  const dna = Object.values(intel.channelDna).map((d) => ({
    youtube_channel_id: d.channelId,
    archetype: orNull(d.archetype),
    archetype_label: orNull(d.archetypeLabel),
    primary_niche: orNull(d.primaryNiche),
    secondary_niches: d.secondaryNiches ?? [],
    content_pillars: d.contentPillars ?? [],
    video_formats: d.dominantVideoFormats ?? [],
    editorial_traits: d.editorialCharacteristics ?? [],
    language: orNull(d.language),
    representative_video_ids: d.representativeVideoIds ?? [],
    confidence: d.classificationConfidence ?? null,
    typical_views: d.typicalViews ?? null,
    typical_duration_seconds: d.typicalDurationSeconds ?? null,
    upload_frequency_days: d.uploadFrequencyDays ?? null,
    analyzed_at: date(d.lastAnalysisDate),
  }));
  report.channelDna = [await insert(tx, "channel_dna", dna), dna.length];

  const relationships = uniqueBy(
    intel.channelRelationships.map((r) => ({
      source_channel_id: r.sourceChannelId,
      target_channel_id: r.targetChannelId,
      similarity_score: r.similarityScore ?? null,
      relationship_type: orNull(r.relationshipType),
      shared_topics: r.sharedTopics ?? [],
      co_occurrence_count: r.coOccurrenceCount ?? null,
      calculated_at: date(r.lastCalculated),
    })),
    (r) => `${r.source_channel_id}|${r.target_channel_id}`,
  );
  report.channelRelationships = [await insert(tx, "channel_relationships", relationships), intel.channelRelationships.length];

  /* ---------------------------------------------------------- title / thumbnail A/B tests */

  // One variant per distinct title or thumbnail, seen from its first to its last observation.
  // Thumbnails are told apart by their image hash, as the scanner does with its own version id.
  const variants = new Map();
  for (const video of Object.values(thumbs.monitoredVideos)) {
    for (const version of video.versions ?? []) {
      for (const [kind, value] of [["title", version.title], ["thumbnail", version.thumbnailHash ?? version.thumbnailUrl]]) {
        if (!value) continue;
        const key = `${video.id}|${kind}|${value}`;
        const first = date(version.firstObservedAt);
        const last = date(version.lastObservedAt ?? version.firstObservedAt);
        const existing = variants.get(key);
        if (existing) {
          if (first < existing.first_seen_at) existing.first_seen_at = existing.set_at = first;
          if (last > existing.last_seen_at) existing.last_seen_at = last;
        } else {
          variants.set(key, { youtube_video_id: video.id, kind, value, set_at: first, first_seen_at: first, last_seen_at: last });
        }
      }
    }
  }
  report.videoVariants = [await insert(tx, "video_variants", [...variants.values()]), variants.size];

  const abAnalyses = Object.values(thumbs.monitoredVideos).map((v) => ({
    youtube_video_id: v.id,
    classification: orNull(v.abTestClassification),
    confidence_score: v.abTestConfidenceScore ?? null,
    evidence: v.abTestEvidence ?? [],
    uncertainty_reasons: v.uncertaintyReasons ?? [],
    performance: v.performanceAnalysis ? sql.json(v.performanceAnalysis) : null,
    niche: orNull(v.nicheCategory),
    first_discovered_at: date(v.firstDiscoveredAt),
    last_change_at: date(v.lastChangeDetectedAt),
    last_observed_at: date(v.lastObservedAt),
  }));
  report.abAnalyses = [await insert(tx, "video_ab_analyses", abAnalyses), abAnalyses.length];

  /* ---------------------------------------------------------- sponsors and alerts */

  const brands = sponsors.brands.map((b) => ({
    id: b.id,
    name: b.name,
    normalized_name: b.normalizedName ?? b.name.toLowerCase(),
    website: orNull(b.website),
    industry: orNull(b.industry),
    contact_email: orNull(b.contactEmail),
    created_at: date(b.createdAt) ?? new Date(),
  }));
  report.sponsorBrands = [await insert(tx, "sponsor_brands", brands), brands.length];

  const sponsorVideos = uniqueBy(
    sponsors.videos.map((v) => ({
      id: v.id,
      youtube_video_id: v.youtubeVideoId,
      title: v.title,
      thumbnail_url: orNull(v.thumbnailUrl),
      published_at: date(v.publishedAt),
      view_count: v.viewCount ?? null,
      duration_formatted: orNull(v.durationFormatted),
      analyzed_at: date(v.analyzedAt),
    })),
    (v) => v.youtube_video_id,
  );
  report.sponsorVideos = [await insert(tx, "sponsor_videos", sponsorVideos), sponsors.videos.length];

  const brandIds = new Set(brands.map((b) => b.id));
  const sponsorVideoIds = new Set(sponsorVideos.map((v) => v.id));
  const sponsorships = sponsors.sponsorships
    .filter((s) => brandIds.has(s.brandId) && sponsorVideoIds.has(s.videoId))
    .map((s) => ({
      id: s.id,
      brand_id: s.brandId,
      sponsor_video_id: s.videoId,
      detection_method: orNull(s.detectionMethod),
      confidence: orNull(s.confidenceScore),
      evidence: orNull(s.evidence),
      time_code: orNull(s.timeCode),
      status: orNull(s.status),
      detected_at: date(s.detectedAt) ?? new Date(),
    }));
  report.sponsorships = [await insert(tx, "sponsorships", sponsorships), sponsors.sponsorships.length];

  const alerts = sponsors.channelAlerts.map((a) => ({
    id: a.id,
    channel_id: a.channelId,
    channel_name: a.channelName,
    channel_avatar: orNull(a.channelAvatar),
    video_id: a.videoId,
    video_title: a.videoTitle,
    video_thumbnail: orNull(a.videoThumbnail),
    published_at: date(a.publishedAt),
    views: a.views ?? 0,
    baseline_views: Math.round(a.baselineViews ?? 0),
    outlier_multiplier: a.outlierMultiplier ?? 1,
    alert_type: a.alertType,
    severity: orNull(a.severity),
    message: a.message,
    is_read: Boolean(a.isRead),
    created_at: date(a.createdAt) ?? new Date(),
  }));
  report.channelAlerts = [await insert(tx, "channel_alerts", alerts), alerts.length];
});

for (const [name, [added, total]] of Object.entries(report)) {
  console.log(`${name.padEnd(22)} ${String(added).padStart(5)} new / ${total} in JSON`);
}
await sql.end();
