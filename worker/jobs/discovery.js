/**
 * Finds new channels worth tracking. Sources, cheapest first:
 *   1. Descriptions of videos already in the database: channel links (UC…) and
 *      @handles creators credit or promote (free to read; handles resolve at 1 unit)
 *   2. Channels featured on our best performers' pages (channelSections, 1 unit)
 *   3. Searches (100 units): niche queries from the taxonomy, aimed at niches the
 *      database covers least and ranked by how many channels each query found
 *      before, plus phrases trending among this week's outliers
 *   +  Channels seen in the daily trending charts (the trending job pays for them)
 *
 * Source ROI: each paid source gets a share of the run's quota proportional to
 * the useful channels (relevant outliers, trending or opportunity) it found per
 * unit over the last DISCOVERY_ROI_DAYS, never under DISCOVERY_MIN_SOURCE_SHARE so
 * a quiet source keeps being explored. Quota a source doesn't use rolls over to
 * the next one. Candidates are vetted in batches (channels.list, 1 unit per 50),
 * best source first: visible subscribers within bounds and enough uploads.
 * Accepted channels are backfilled by the backfill job on the next ticks.
 */
import { sql } from "../../lib/sql.js";
import { youtubeApi, chunk, subBudget, QuotaExceededError } from "../../lib/youtube.js";
import { NICHES } from "../../lib/taxonomy/index.js";
import { CONFIG } from "../config.js";
import { saveApiChannels, saveApiVideos, VIDEO_PARTS, CHANNEL_PARTS } from "../store.js";

export const PAID_SOURCES = ["description", "featured", "search"];
const ALL_SOURCES = [...PAID_SOURCES, "trending"];

export async function runDiscovery({ budget, since, pilot }) {
  // The quota pilot pauses discovery while refreshes need almost all the quota.
  const maxNew = pilot?.maxNewChannels ?? CONFIG.discoveryMaxNewPerRun;
  if (budget.allowed === 0 || maxNew === 0) return { skipped: "quota headroom too low", headroom: pilot?.headroom ?? null };

  const perSource = () => Object.fromEntries(ALL_SOURCES.map((s) => [s, 0]));
  const d = {
    description: { videos: 0, channelLinks: 0, handles: 0, resolved: 0 },
    featured: { checked: 0, found: 0 },
    search: { queries: [], videos: 0 },
    candidates: 0,
    vetted: 0,
    added: 0,
    rejected: 0,
    candidatesBy: perSource(),
    vettedBy: perSource(),
    addedBy: perSource(),
    unitsBy: perSource(),
    videosSaved: 0,
  };
  const candidates = new Map(); // YouTube channel id -> first source
  const addCandidate = (id, source) => {
    if (id && /^UC[\w-]{22}$/.test(id) && !candidates.has(id)) {
      candidates.set(id, source);
      d.candidatesBy[source]++;
    }
  };
  const foundVideos = new Set(); // video ids found by searches
  const channelsByQuery = new Map();

  // Vetting is paid last: keep enough for it before splitting the rest.
  const vettingReserve = Math.ceil(maxNew / 50) + 2;
  const roi = await sourceRoi();
  const plan = allocateSources(roi, Math.max(0, budget.allowed - vettingReserve), CONFIG.discoveryMinSourceShare);
  d.roi = roi;
  d.plan = plan;

  const runners = {
    description: (slice) => mineDescriptions(d, addCandidate, since, slice),
    featured: (slice) => featuredChannels(d, addCandidate, slice),
    search: (slice) => searches(d, addCandidate, foundVideos, channelsByQuery, slice),
  };
  let carry = 0;
  for (const source of PAID_SOURCES) {
    const slice = subBudget(budget, Math.min(plan[source] + carry, Math.max(0, budget.left - vettingReserve)));
    try {
      await runners[source](slice);
    } catch (err) {
      if (!(err instanceof QuotaExceededError)) throw err;
      if (budget.left <= vettingReserve) d.quotaExhausted = true;
    }
    d.unitsBy[source] = slice.spent;
    carry = Math.max(0, slice.allowed - slice.spent);
  }
  await trendingCandidates(addCandidate);

  d.maxNew = maxNew;
  const vettingStart = budget.spent;
  const added = await vetCandidates(d, candidates, budget, maxNew, roi).catch((err) => {
    if (err instanceof QuotaExceededError) return new Set();
    throw err;
  });
  const vettingUnits = budget.spent - vettingStart;

  for (const [query, found] of channelsByQuery) {
    const newChannels = [...found].filter((id) => added.has(id)).length;
    if (newChannels) await sql`update discovery_queries set new_channels = new_channels + ${newChannels} where query = ${query}`;
  }

  // Store the videos the searches found (their channel may be known now).
  try {
    const ids = [...foundVideos];
    const known = ids.length
      ? new Set((await sql`select youtube_video_id from videos where youtube_video_id in ${sql(ids)}`).map((r) => r.youtube_video_id))
      : new Set();
    for (const batch of chunk(ids.filter((id) => !known.has(id)), 50)) {
      const data = await youtubeApi("videos", { part: VIDEO_PARTS, id: batch.join(","), maxResults: "50" }, budget);
      d.unitsBy.search++;
      d.videosSaved += (await saveApiVideos(data.items ?? [])).saved;
    }
  } catch (err) {
    if (!(err instanceof QuotaExceededError)) throw err;
    d.quotaExhausted = true;
  }

  // Vetting units go to each source in proportion to the candidates it had vetted.
  const vettedTotal = Object.values(d.vettedBy).reduce((a, b) => a + b, 0);
  for (const source of ALL_SOURCES) {
    const vettingShare = vettedTotal ? Math.round((vettingUnits * d.vettedBy[source]) / vettedTotal) : 0;
    d.unitsBy[source] += vettingShare;
    // Trending's own charts are recorded by the trending job.
    await recordSpend(source, {
      units: d.unitsBy[source],
      candidates: source === "trending" ? 0 : d.candidatesBy[source],
      added: d.addedBy[source],
    });
  }
  return d;
}

// ---------------------------------------------------------------------------
// Source ROI
// ---------------------------------------------------------------------------

/** Adds a run's spend to today's row for the source. */
export async function recordSpend(source, { units = 0, candidates = 0, added = 0 }) {
  if (!units && !candidates && !added) return;
  await sql`
    insert into discovery_spend (day, source, units, candidates, added)
    values (current_date, ${source}, ${units}, ${candidates}, ${added})
    on conflict (day, source) do update set
      units = discovery_spend.units + excluded.units,
      candidates = discovery_spend.candidates + excluded.candidates,
      added = discovery_spend.added + excluded.added`;
}

/**
 * Per source over the ROI window: units spent, channels added, and how many of
 * those turned out useful (a relevant video, a trend score >= 40 or an
 * opportunity score >= 50). Channels added come from the spend rows (what this
 * worker paid for); the useful share is measured on every channel the source
 * brought in over the window.
 */
export async function sourceRoi(days = CONFIG.discoveryRoiDays) {
  const rows = await sql`
    with spend as (
      select source, sum(units)::int as units, sum(candidates)::int as candidates, sum(added)::int as added
      from discovery_spend
      where day > current_date - ${days}::int
      group by source
    ),
    quality as (
      select c.discovered_via as source, count(*)::int as channels,
        count(*) filter (where c.trend_score >= 40 or c.opportunity_score >= 50 or exists (
          select 1 from videos v where v.channel_id = c.id and v.relevance_score is not null
        ))::int as useful
      from channels c
      where c.discovered_at > now() - make_interval(days => ${days})
      group by c.discovered_via
    )
    select s.source, coalesce(sp.units, 0)::int as units, coalesce(sp.candidates, 0)::int as candidates,
      coalesce(sp.added, 0)::int as added,
      coalesce(q.useful::float8 / nullif(q.channels, 0), 0) as useful_share
    from unnest(string_to_array(${ALL_SOURCES.join(",")}, ',')) as s(source)
    left join spend sp on sp.source = s.source
    left join quality q on q.source = s.source`;
  return rows.map((r) => {
    const useful = Math.round(r.added * r.useful_share);
    return {
      source: r.source,
      units: r.units,
      candidates: r.candidates,
      added: r.added,
      useful,
      usefulShare: Math.round(r.useful_share * 100) / 100,
      perHundredUnits: roiPerHundredUnits(useful, r.units),
    };
  });
}

/** Useful channels per 100 units, with a prior of 1 per 100 so a new source gets a chance. */
export const roiPerHundredUnits = (useful, units) => Math.round(((useful + 1) / (units + 100)) * 10_000) / 100;

/**
 * Splits `units` between the paid sources in proportion to their ROI, each
 * getting at least `minShare`. Pure, for tests.
 */
export function allocateSources(roi, units, minShare = 0.1) {
  const paid = PAID_SOURCES.map((source) => ({
    source,
    roi: roi.find((r) => r.source === source)?.perHundredUnits ?? 1,
  }));
  const sum = paid.reduce((acc, p) => acc + p.roi, 0) || 1;
  const shares = paid.map((p) => ({ ...p, share: Math.max(minShare, p.roi / sum) }));
  const total = shares.reduce((acc, p) => acc + p.share, 0);
  return Object.fromEntries(shares.map((p) => [p.source, Math.floor((units * p.share) / total)]));
}

// ---------------------------------------------------------------------------
// 1. Descriptions
// ---------------------------------------------------------------------------

const CHANNEL_LINK = /youtube\.com\/channel\/(UC[\w-]{22})/g;
const HANDLE = /(?:youtube\.com\/|^|[\s(])@([A-Za-z0-9._-]{3,30})\b/gm;

async function mineDescriptions(d, addCandidate, since, budget) {
  // Videos added since the last run, plus this month's outliers (they credit collaborators).
  const videos = await sql`
    select v.description, c.handle as own_handle
    from videos v
    join channels c on c.id = v.channel_id
    where v.description ~ '(@|youtube\\.com/channel/)'
      and (v.created_at > ${since} or (v.relevance_score is not null and v.published_at > now() - interval '30 days'))
    limit 20000`;
  d.description.videos = videos.length;

  const mentions = new Map();
  for (const { description, own_handle: ownHandle } of videos) {
    for (const [, id] of description.matchAll(CHANNEL_LINK)) {
      d.description.channelLinks++;
      addCandidate(id, "description");
    }
    const own = String(ownHandle ?? "").replace(/^@/, "").toLowerCase();
    const seen = new Set();
    for (const [, raw] of description.matchAll(HANDLE)) {
      const handle = raw.replace(/[._-]+$/, "").toLowerCase();
      // Emails ("name@gmail.com") and the channel's own handle are not mentions.
      if (handle === own || seen.has(handle) || /\.(com|net|org|fr|io)$/.test(handle)) continue;
      seen.add(handle);
      mentions.set(handle, (mentions.get(handle) ?? 0) + 1);
    }
  }
  d.description.handles = mentions.size;
  for (const batch of chunk([...mentions], 500)) {
    await sql`
      insert into discovery_handles (handle, mentions)
      select * from unnest(${batch.map(([h]) => h)}::text[], ${batch.map(([, n]) => n)}::int[])
      on conflict (handle) do update set mentions = discovery_handles.mentions + excluded.mentions`;
  }

  // Resolve the most mentioned handles we don't know yet (1 unit each).
  const toResolve = await sql`
    select h.handle
    from discovery_handles h
    where h.resolved_at is null
      and not exists (select 1 from channels c where lower(c.handle) = '@' || h.handle)
    order by h.mentions desc, h.first_seen_at
    limit ${Math.max(0, Math.min(CONFIG.discoveryHandlesPerRun, budget.left))}`;
  for (const { handle } of toResolve) {
    const data = await youtubeApi("channels", { part: "id", forHandle: `@${handle}` }, budget);
    const id = data.items?.[0]?.id ?? null;
    await sql`update discovery_handles set youtube_channel_id = ${id}, resolved_at = now() where handle = ${handle}`;
    if (id) {
      d.description.resolved++;
      addCandidate(id, "description");
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Featured channels
// ---------------------------------------------------------------------------

async function featuredChannels(d, addCandidate, budget) {
  const sources = await sql`
    select c.id, c.youtube_channel_id
    from channels c
    left join lateral (
      select max(relevance_score) as best from videos v
      where v.channel_id = c.id and v.published_at > now() - interval '30 days'
    ) r on true
    where c.rss_error_count < 5
      and (c.featured_checked_at is null or c.featured_checked_at < now() - interval '30 days')
    order by r.best desc nulls last, c.trend_score desc nulls last
    limit ${Math.max(0, Math.min(CONFIG.discoveryFeaturedPerRun, budget.left))}`;
  for (const source of sources) {
    const data = await youtubeApi("channelSections", { part: "contentDetails", channelId: source.youtube_channel_id }, budget).catch(
      (err) => {
        if (err instanceof QuotaExceededError) throw err;
        return { items: [] };
      },
    );
    for (const section of data.items ?? []) {
      for (const id of section.contentDetails?.channels ?? []) {
        d.featured.found++;
        addCandidate(id, "featured");
      }
    }
    d.featured.checked++;
    await sql`update channels set featured_checked_at = now() where id = ${source.id}`;
  }
}

// ---------------------------------------------------------------------------
// Trending (charts stored by the trending job; free here)
// ---------------------------------------------------------------------------

async function trendingCandidates(addCandidate) {
  // Music labels aren't creator material.
  const rows = await sql`
    select t.youtube_channel_id, min(t.rank) as best_rank
    from trending_entries t
    where t.day >= current_date - 1 and t.video_category_id is distinct from 10
      and not exists (select 1 from channels c where c.youtube_channel_id = t.youtube_channel_id)
    group by t.youtube_channel_id
    order by best_rank`;
  for (const row of rows) addCandidate(row.youtube_channel_id, "trending");
}

// ---------------------------------------------------------------------------
// 3. Searches
// ---------------------------------------------------------------------------

async function searches(d, addCandidate, foundVideos, channelsByQuery, budget) {
  // Queries come from the taxonomy (one set per niche), .env seeds and auto phrases.
  const seeds = [
    ...NICHES.filter((n) => (n.discoveryWeight ?? 1) > 0).flatMap((n) =>
      n.discovery.map((q) => ({ query: q.toLowerCase(), source: "niche", niche: n.id })),
    ),
    ...CONFIG.discoverySeedQueries.map((q) => ({ query: q.toLowerCase(), source: "seed", niche: null })),
    ...(await trendingPhrases(5)).map((q) => ({ query: q, source: "auto", niche: null })),
  ];
  for (const batch of chunk(seeds, 200)) {
    await sql`
      insert into discovery_queries (query, source, niche)
      select * from unnest(
        ${batch.map((s) => s.query)}::text[],
        ${batch.map((s) => s.source)}::text[],
        ${batch.map((s) => s.niche)}::text[]
      )
      on conflict (query) do update set niche = coalesce(discovery_queries.niche, excluded.niche)`;
  }

  // Score = past yield x niche gap (dampened, capped at 3x) x niche weight.
  // Queries that found nothing in 3 runs rest for 30 days.
  // One unit per search stays free to fetch the found videos' stats.
  const weights = NICHES.map((n) => ({ niche: n.id, weight: n.discoveryWeight ?? 1 }));
  const queries = await sql`
    with weights as (
      select * from jsonb_to_recordset(${sql.json(weights)}) as w(niche text, weight float8)
    ),
    coverage as (
      select niche, count(*)::float8 as channels from channels where niche is not null and rss_error_count < 5 group by niche
    ),
    total as (select greatest(sum(channels), 1) as n, greatest(count(*), 1) as niches from coverage)
    select q.query, q.source
    from discovery_queries q
    left join coverage cv on cv.niche = q.niche
    left join weights w on w.niche = q.niche
    cross join total t
    where (q.last_run_at is null or q.last_run_at < now() - interval '3 days')
      and not (q.runs >= 3 and q.new_channels = 0 and q.last_run_at > now() - interval '30 days')
    order by
      ((q.new_channels + 1)::float8 / (q.runs + 1))
      * case when q.niche is null then 1.2
          else least(3, sqrt((t.n / t.niches) / greatest(coalesce(cv.channels, 0), 5))) * coalesce(w.weight, 1)
        end desc,
      q.last_run_at nulls first
    limit ${Math.max(0, Math.min(CONFIG.discoverySearchesPerRun, Math.floor(budget.left / 101)))}`;

  const publishedAfter = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  for (const { query, source } of queries) {
    const data = await youtubeApi(
      "search",
      { part: "snippet", type: "video", order: "viewCount", publishedAfter, maxResults: "50", q: query },
      budget,
    );
    const found = new Set();
    for (const item of data.items ?? []) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;
      d.search.videos++;
      addCandidate(item.snippet?.channelId, "search");
      found.add(item.snippet?.channelId);
      foundVideos.add(videoId);
    }
    channelsByQuery.set(query, found);
    d.search.queries.push(source === "niche" ? query : `${query} (${source})`);
    await sql`
      update discovery_queries
      set last_run_at = now(), runs = runs + 1, videos_found = videos_found + ${data.items?.length ?? 0}
      where query = ${query}`;
  }
}

const STOPWORDS = new Set(
  `the a an and or of to in on for with is are was be this that it my your our you i me we they he she his her at by
  from as how what why who when where vs not no do does did can will just new video videos official full part ep
  episode live shorts short youtube channel day days year years first best top get got make made one two all out up
  into about over more most so if but its i'm don't le la les de des du un une et en est pour pas qui que sur avec
  dans ce cette mon ma mes il elle on je tu nous vous ils par plus fait faire`.split(/\s+/),
);

function titleTokens(title) {
  return (title ?? "")
    .toLowerCase()
    .replace(/https?:\S+/g, " ")
    .replace(/[^\p{L}\p{N}' ]+/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/** Two-word phrases over-represented in this week's outliers, across at least 3 channels. */
async function trendingPhrases(limit) {
  const rows = await sql`
    select title, channel_id,
      (relevance_score is not null and outlier_multiplier >= 3 and published_at > now() - interval '7 days') as outlier
    from videos
    where published_at > now() - interval '120 days'`;
  const outlierCount = rows.filter((r) => r.outlier).length;
  if (!outlierCount) return [];
  const phrases = new Map();
  for (const row of rows) {
    const words = titleTokens(row.title);
    const bigrams = new Set(words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`));
    for (const phrase of bigrams) {
      let p = phrases.get(phrase);
      if (!p) phrases.set(phrase, (p = { base: 0, outliers: 0, channels: new Set() }));
      p.base++;
      if (row.outlier) {
        p.outliers++;
        p.channels.add(row.channel_id);
      }
    }
  }
  return [...phrases]
    .map(([phrase, p]) => ({ phrase, channels: p.channels.size, lift: p.outliers / outlierCount / (p.base / rows.length) }))
    .filter((p) => p.channels >= 3 && p.lift >= 3)
    .sort((a, b) => b.channels * Math.log(b.lift) - a.channels * Math.log(a.lift))
    .slice(0, limit)
    .map((p) => p.phrase);
}

// ---------------------------------------------------------------------------
// Vetting
// ---------------------------------------------------------------------------

async function vetCandidates(d, candidates, budget, maxNew, roi) {
  d.candidates = candidates.size;
  const ids = [...candidates.keys()];
  const known = new Set();
  for (const batch of chunk(ids, 1000)) {
    const rows = await sql`
      select youtube_channel_id from channels where youtube_channel_id in ${sql(batch)}
      union
      select youtube_channel_id from discovery_rejected
      where rejected_at > now() - interval '60 days' and youtube_channel_id in ${sql(batch)}`;
    for (const row of rows) known.add(row.youtube_channel_id);
  }
  // Best sources first (ROI), so a flood from one source can't crowd out the others' finds.
  const rank = Object.fromEntries(
    [...roi].sort((a, b) => b.perHundredUnits - a.perHundredUnits).map((r, i) => [r.source, i]),
  );
  const toVet = ids
    .filter((id) => !known.has(id))
    .sort((a, b) => (rank[candidates.get(a)] ?? 9) - (rank[candidates.get(b)] ?? 9))
    .slice(0, maxNew);

  const added = new Set();
  const rejections = [];
  for (const batch of chunk(toVet, 50)) {
    const data = await youtubeApi("channels", { part: CHANNEL_PARTS, id: batch.join(","), maxResults: "50" }, budget);
    for (const id of batch) d.vettedBy[candidates.get(id)]++;
    const returned = new Set();
    const accepted = [];
    for (const item of data.items ?? []) {
      returned.add(item.id);
      d.vetted++;
      const s = item.statistics ?? {};
      const subs = s.hiddenSubscriberCount ? null : Number(s.subscriberCount ?? 0);
      const reason =
        subs == null ? "hidden_subscribers"
        : subs < CONFIG.discoveryMinSubs ? "too_small"
        : subs > CONFIG.discoveryMaxSubs ? "too_big"
        : Number(s.videoCount ?? 0) < CONFIG.discoveryMinVideos ? "too_few_videos"
        : null;
      if (reason) rejections.push({ youtube_channel_id: item.id, reason });
      else accepted.push(item);
    }
    for (const id of batch.filter((id) => !returned.has(id))) rejections.push({ youtube_channel_id: id, reason: "not_found" });

    for (const source of ALL_SOURCES) {
      const items = accepted.filter((item) => candidates.get(item.id) === source);
      if (!items.length) continue;
      await saveApiChannels(items, { discovered_via: source, discovered_at: new Date() });
      d.addedBy[source] += items.length;
    }
    for (const item of accepted) added.add(item.id);
    d.added += accepted.length;
  }
  d.rejected = rejections.length;
  for (const batch of chunk(rejections, 500)) {
    await sql`
      insert into discovery_rejected ${sql(batch)}
      on conflict (youtube_channel_id) do update set rejected_at = now(), reason = excluded.reason`;
  }
  return added;
}
