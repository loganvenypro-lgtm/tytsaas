import { sql } from "../lib/sql.js";
import { describeSpec } from "../lib/filterSpec.js";
import { NICHES, FORMATS, HOOKS, CATEGORIES, LANGUAGES, CLASSIFIER_VERSION } from "../lib/taxonomy/index.js";
import { VIDEO_SPEC } from "./videos.js";
import { CHANNEL_SPEC } from "./channels.js";

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();

async function cached(key, compute) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = await compute();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const toMap = (rows) => new Map(rows.map((r) => [String(r.value), Number(r.count)]));

/** How many videos of the last 90 days each option would match. */
async function videoCounts() {
  const recent = sql`published_at > now() - interval '90 days' and not is_livestream`;
  const [niche, subNiche, style, language, category, hooks, country] = await Promise.all([
    sql`select niche as value, count(*) from videos where ${recent} and niche is not null group by 1`,
    sql`select sub_niche as value, count(*) from videos where ${recent} and sub_niche is not null group by 1`,
    sql`select format as value, count(*) from videos where ${recent} and format is not null group by 1`,
    sql`select lang as value, count(*) from videos where ${recent} and lang is not null group by 1`,
    sql`select category_id as value, count(*) from videos where ${recent} and category_id is not null group by 1`,
    sql`select unnest(title_hooks) as value, count(*) from videos where ${recent} group by 1`,
    sql`
      select c.country as value, count(*) from videos v join channels c on c.id = v.channel_id
      where v.published_at > now() - interval '90 days' and c.country is not null group by 1`,
  ]);
  return {
    niche: toMap(niche),
    subNiche: toMap(subNiche),
    style: toMap(style),
    language: toMap(language),
    category: toMap(category),
    hooks: toMap(hooks),
    country: toMap(country),
  };
}

async function channelCounts() {
  const active = sql`rss_error_count < 5`;
  const [niche, subNiche, style, language, category, country, ypp] = await Promise.all([
    sql`select niche as value, count(*) from channels where ${active} and niche is not null group by 1`,
    sql`select sub_niche as value, count(*) from channels where ${active} and sub_niche is not null group by 1`,
    sql`select primary_format as value, count(*) from channels where ${active} and primary_format is not null group by 1`,
    sql`select lang as value, count(*) from channels where ${active} and lang is not null group by 1`,
    sql`select category_id as value, count(*) from channels where ${active} and category_id is not null group by 1`,
    sql`select country as value, count(*) from channels where ${active} and country is not null group by 1`,
    sql`select ypp_status as value, count(*) from channels where ${active} and ypp_status is not null group by 1`,
  ]);
  return {
    niche: toMap(niche),
    subNiche: toMap(subNiche),
    style: toMap(style),
    language: toMap(language),
    category: toMap(category),
    country: toMap(country),
    ypp: toMap(ypp),
  };
}

/** Countries have no fixed list: their options are the ones present in the database. */
function withCountries(description, counts) {
  const filter = description.filters.find((f) => f.key === "country");
  if (filter) {
    filter.options = [...(counts.country ?? [])]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, label: { en: value, fr: value }, count }));
  }
  return description;
}

export async function videoFilters(req, res) {
  const counts = await cached("videos", videoCounts);
  res.json(withCountries(describeSpec(VIDEO_SPEC, counts), counts));
}

export async function channelFilters(req, res) {
  const counts = await cached("channels", channelCounts);
  res.json(withCountries(describeSpec(CHANNEL_SPEC, counts), counts));
}

/** The full taxonomy: niches with their sub-niches, video styles, hooks, categories, languages. */
export async function taxonomy(req, res) {
  res.json({
    version: CLASSIFIER_VERSION,
    niches: NICHES.map((n) => ({
      id: n.id,
      label: n.label,
      subNiches: n.subNiches.map((s) => ({ id: s.id, label: s.label })),
    })),
    styles: FORMATS.map((f) => ({ id: f.id, label: f.label })),
    hooks: HOOKS.map((h) => ({ id: h.id, label: h.label })),
    categories: Object.entries(CATEGORIES).map(([id, label]) => ({ id: Number(id), label })),
    languages: Object.entries(LANGUAGES).map(([id, label]) => ({ id, label })),
  });
}
