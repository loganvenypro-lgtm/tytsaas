import { sql } from "./sql.js";
import { textTopic } from "./classifier.js";
import { mode, titleTerms } from "./titleKeywords.js";

const RECENT_VIDEOS = 60;
const MAX_TERMS = 16;

/** { id: weight } → { id: share }, shares under `min` dropped (they are noise, not a topic). */
function shares(weights, min = 0.08) {
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (!total) return {};
  return Object.fromEntries(
    [...weights]
      .map(([id, w]) => [id, w / total])
      .filter(([, s]) => s >= min)
      .sort((a, b) => b[1] - a[1])
      .map(([id, s]) => [id, Math.round(s * 1000) / 1000]),
  );
}

const add = (map, key, weight) => key != null && map.set(key, (map.get(key) ?? 0) + weight);

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * What a channel is about, read from its last videos (all from the database, no
 * YouTube quota). The worker classifies every video, so the niche, sub-niche and
 * style come from how its videos spread across them, the channel's own label only
 * counting as a share: a channel labelled wrongly (low confidence) still gets the
 * topics its videos are about. Keywords are the words and bigrams that come back
 * in its titles and description, weighted by how rare they are in the whole
 * database (IDF), so "minecraft" or "dark web" count and "video" does not. Hype
 * words ("dark", "crazy") never count on their own.
 *
 * `channel` is a channels row (id, niche, sub_niche, niche_confidence, primary_format, lang, short_share, description).
 */
export async function channelProfile(channel) {
  const videos = await sql`
    SELECT title, niche, sub_niche, niche_confidence, format, is_short, duration_seconds, lang, title_hooks
    FROM videos
    WHERE channel_id = ${channel.id}
    ORDER BY published_at DESC
    LIMIT ${RECENT_VIDEOS}`;
  const n = videos.length;

  // Topics and style: each classified video votes (more when the classifier was sure), the channel label is one more voice.
  const niches = new Map();
  const subNiches = new Map();
  const formats = new Map();
  const hooks = new Map();
  for (const v of videos) {
    if (v.niche) {
      const weight = 0.5 + 0.5 * Number(v.niche_confidence ?? 0.5);
      add(niches, v.niche, weight);
      add(subNiches, v.sub_niche, weight);
    } else {
      // Left unclassified by the worker: the title alone still hints at a topic, worth half a vote.
      const hint = textTopic(v.title);
      add(niches, hint?.niche, 0.5);
      add(subNiches, hint?.subNiche, 0.5);
    }
    add(formats, v.format, 1);
    for (const h of v.title_hooks ?? []) add(hooks, h, 1 / v.title_hooks.length);
  }
  // Squared: a 0.2-confidence label (often a wrong guess) weighs 4 % of a sure one.
  const channelWeight = Math.max(3, n * 0.3) * Math.min(1, Number(channel.niche_confidence ?? 0)) ** 2;
  add(niches, channel.niche, channelWeight);
  add(subNiches, channel.sub_niche, channelWeight);
  add(formats, channel.primary_format, Math.max(2, n * 0.2));

  const shortShare = n ? videos.filter((v) => v.is_short).length / n : Number(channel.short_share ?? 0);
  const longDurations = videos.filter((v) => !v.is_short && v.duration_seconds > 0).map((v) => v.duration_seconds);
  const lang = channel.lang ?? mode(videos.map((v) => v.lang));

  return {
    niches: shares(niches),
    subNiches: shares(subNiches),
    formats: shares(formats, 0.1),
    hooks: shares(hooks, 0.05),
    lang,
    shortShare: Math.round(shortShare * 100) / 100,
    medianDuration: median(longDurations.length ? longDurations : videos.map((v) => v.duration_seconds).filter((d) => d > 0)),
    terms: await weightedTerms(channel, videos.map((v) => v.title), lang),
  };
}

// Words of a channel description that are about the channel, not its topic.
const DESCRIPTION_NOISE = new Set(
  `com www http https instagram twitter tiktok facebook linkedin discord patreon twitch subscribe follow merch business
  inquiries inquiry email contact sponsor sponsorship podcast weekly daily videos channel welcome thanks thank support
  abonne abonnez chaine partenariat`.split(/s+/),
);

/**
 * The channel's dominant words and bigrams with their weight (share of its titles
 * holding the term × IDF over the titles of the database in the same language,
 * max weight = 1). The description adds terms worth less than one title each.
 * Terms no other channel uses are dropped: they match nothing.
 */
async function weightedTerms(channel, titles, lang) {
  const inTitles = titleTerms(titles);
  const inDescription = titleTerms(channel.description ? [channel.description.slice(0, 600)] : []);
  const ownName = new Set(titleTerms([`${channel.name ?? ""} ${channel.handle ?? ""}`]).keys());

  const candidates = [...new Set([...inTitles.keys(), ...inDescription.keys()])]
    .map((term) => ({ term, count: inTitles.get(term) ?? 0, described: inDescription.has(term) }))
    .filter((t) => !t.term.split(" ").some((w) => ownName.has(w)))
    .filter((t) => t.count >= 2 || (t.described && !t.term.split(" ").some((w) => DESCRIPTION_NOISE.has(w))))
    .sort((a, b) => b.count + Number(b.described) - (a.count + Number(a.described)))
    .slice(0, 48);
  if (!candidates.length) return [];

  // Document frequencies within the channel's language: French function words are rare in a mostly English database.
  const [{ total: langTotal }] = lang ? await sql`SELECT count(*)::int AS total FROM videos WHERE lang = ${lang}` : [{ total: 0 }];
  const byLang = langTotal >= 2000;
  const queries = candidates.map((t) => t.term.replace(" ", " <-> "));
  const [stats, [{ total }]] = await Promise.all([
    sql`
      SELECT t.q,
        (SELECT count(*) FROM videos v
         WHERE to_tsvector('simple', v.title) @@ to_tsquery('simple', t.q)
           AND v.channel_id <> ${channel.id}
           ${byLang ? sql`AND v.lang = ${lang}` : sql``})::int AS df
      FROM unnest(${queries}::text[]) AS t(q)`,
    byLang ? [{ total: langTotal }] : sql`SELECT greatest(reltuples::bigint, 1) AS total FROM pg_class WHERE relname = 'videos'`,
  ]);
  const df = new Map(stats.map((s) => [s.q, s.df]));

  const n = Math.max(titles.length, 1);
  const weighted = candidates
    .map((t, i) => {
      const others = df.get(queries[i]) ?? 0;
      const idf = Math.log(Number(total) / (others + 1));
      const share = (t.count + (t.described ? 0.75 : 0)) / n;
      // A bigram is a sharper signal than either of its words.
      return { term: t.term, query: queries[i], others, share: t.count / n, described: t.described && !t.count, weight: share * idf * (t.term.includes(" ") ? 1.5 : 1) };
    })
    // Description-only terms must be real topics other titles use, not prose.
    .filter((t) => t.others >= (t.described ? 25 : 2) && t.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_TERMS);

  const max = weighted[0]?.weight ?? 1;
  // share: how many of its titles hold the term, what a channel just as focused on it would match.
  return weighted.map((t) => ({ term: t.term, query: t.query, weight: Math.round((t.weight / max) * 1000) / 1000, share: Math.round(t.share * 1000) / 1000 }));
}
