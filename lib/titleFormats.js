import crypto from "node:crypto";
import { HOOKS } from "./taxonomy/index.js";

/**
 * Title formats: recurring title structures with a variable slot, like
 * "I Can't Stop Thinking About [X]" or "Where Are The [X] Today".
 *
 * Every title is cut into words, and each way of keeping its first words, its
 * last words, or both, as a fixed part (the rest being [X]) is a candidate.
 * Candidates shared by enough titles from enough different channels become
 * formats; when a format mostly repeats a more specific one ("I Can't Stop
 * [X]" vs "I Can't Stop Thinking About [X]"), only the specific one is kept.
 */

const MIN_VIDEOS = 5;
const MIN_CHANNELS = 4;
// One channel's series ("Minecraft Hardcore Day [X]") is a habit, not a format.
const MAX_CHANNEL_SHARE = 0.5;
const MAX_FIXED_SIDE = 6;
const MAX_SLOT = 6;
const MAX_TITLE_WORDS = 16;
// Share of a format's videos already explained by a more specific format above which it is dropped.
const MAX_OVERLAP = 0.5;
// Multipliers are capped before averaging: one 400x video would otherwise make any format look great.
const MULTIPLIER_CAP = 30;
// Average channels a format is assumed to share with the pool before its own (see mineTitleFormats).
const PRIOR_CHANNELS = 4;

// Words too common to make a formula on their own ("The [X]", "How To [X]").
const FILLER = new Set(
  `a an the of in on to for and or with at by from is are was be it this that my your i you we our me how what why
   de la le les des du un une et en à au aux pour avec sur par ce cette mon ma mes je tu on nous vous est qui que`.split(/\s+/),
);

/** A title's words (punctuation trimmed), from its main part: no hashtags, emojis, brackets or "| Channel" tail. */
export function titleWords(title) {
  const cleaned = String(title ?? "")
    .replace(/[’‘`]/g, "'")
    .replace(/#[\p{L}\p{N}_]+/gu, " ")
    .replace(/\([^)]*\)|\[[^\]]*\]|【[^】]*】/g, " ")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ");
  const main = cleaned.split(/\s[|•–—-]\s|\|/)[0];
  return main
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}$€£]+|[^\p{L}\p{N}%$€£']+$/gu, ""))
    .filter(Boolean);
}

const keyOf = (prefix, suffix) => `${prefix.join(" ")}\u0001${suffix.join(" ")}`.toLowerCase();

/** Every (prefix, suffix) split of a title that leaves a slot of 1-MAX_SLOT words. */
function* splits(words) {
  const n = words.length;
  for (let p = 0; p <= MAX_FIXED_SIDE; p++) {
    for (let s = 0; s <= MAX_FIXED_SIDE; s++) {
      const slot = n - p - s;
      if (p + s < 2 || slot < 1 || slot > MAX_SLOT) continue;
      // A slot in the middle must stay short, or the formula says little
      if (p > 0 && s > 0 && slot > 4) continue;
      yield [p, s];
    }
  }
}

const MONTH =
  /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)$/;
// Each word of the fixed part must be used by this many channels across the pool:
// rarer words are names and topics ("Christa Pike [X]"), not a way of titling.
const MIN_WORD_CHANNELS = 30;

function usableFixed(tokens, wordChannels) {
  const lower = tokens.map((w) => w.toLowerCase());
  if (lower.some((w) => MONTH.test(w))) return false;
  const meaningful = lower.filter((w) => !FILLER.has(w) && !/^\d+$/.test(w));
  if (meaningful.some((w) => (wordChannels.get(w) ?? 0) < MIN_WORD_CHANNELS)) return false;
  if (lower.length >= 3) return meaningful.length >= 1 || lower.length >= 4;
  return meaningful.length >= 1 && lower.join("").length >= 9;
}

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  for (const [v, c] of counts) if (c > counts.get(best)) best = v;
  return best;
}

function cappedMean(values) {
  return values.reduce((sum, v) => sum + Math.min(v, MULTIPLIER_CAP), 0) / values.length;
}

// Why a title makes people click, read from its hooks (lib/taxonomy/hooks.js).
const DRIVERS_BY_HOOK = {
  question: ["openLoop"],
  curiosity_gap: ["curiosity", "openLoop"],
  secret_reveal: ["curiosity"],
  rise_fall: ["openLoop", "story"],
  money: ["desire"],
  transformation: ["desire", "story"],
  challenge_duration: ["challenge"],
  superlative: ["awe"],
  extreme: ["awe"],
  warning: ["fear"],
  negativity: ["fear"],
  authority_proof: ["authority"],
  urgency_new: ["urgency"],
  first_person: ["relatability"],
  versus: ["conflict"],
  list: ["clarity"],
};
// Extra cues in the formula itself that the hook taxonomy doesn't name.
const FORMULA_DRIVERS = [
  ["desire", /\b(need|want|dream|best|perfect|ultimate|rich|free|easy|secret to|how to get|besoin|rêve|parfait|facile|gratuit)\b/i],
  ["openLoop", /\b(why|what happened|where are|whatever happened|the truth|this is|nobody|until|pourquoi|où sont|ce qui|personne)\b/i],
  ["curiosity", /\b(can'?t stop|thinking about|weird|strange|unusual|surprising|actually|really|bizarre|étrange|vraiment)\b/i],
  ["relatability", /\b(i|my|me|we|you|your|je|j'ai|mon|ma|tu|ton|vous)\b/i],
  ["fear", /\b(stop|never|don'?t|mistake|avoid|warning|danger|arrêtez|jamais|erreur|danger)\b/i],
  ["awe", /\b(most|biggest|insane|crazy|impossible|world'?s|too much|on another level|plus grand|incroyable|fou)\b/i],
  ["openLoop", /\b(the reason|is different|the moment|fooled|changes everything|because of this|for a reason|la raison)\b/i],
  ["clarity", /\b(how to|explained|guide|tutorial|for beginners|from scratch|step by step|in \d+ minutes|comment|expliqué|tuto|débutants)\b/i],
  ["challenge", /\b(only \d+|can you|try not|challenge|survived?|i tried|testing|for \d+ days|défi|survivre|j'ai testé)\b/i],
  ["conflict", /\b(vs|versus|against|destroyed|exposed|contre|détruit)\b/i],
];

function clickDrivers(formula, hookShares) {
  const scores = new Map();
  const add = (driver, score) => scores.set(driver, (scores.get(driver) ?? 0) + score);
  for (const hook of HOOKS) {
    if (hook.re.test(formula)) for (const d of DRIVERS_BY_HOOK[hook.id] ?? []) add(d, 1);
  }
  for (const [driver, re] of FORMULA_DRIVERS) if (re.test(formula)) add(driver, 1);
  // Hooks most of the titles share, whatever fills [X]
  for (const [hook, share] of hookShares) {
    if (share >= 0.4) for (const d of DRIVERS_BY_HOOK[hook] ?? []) add(d, share);
  }
  // A formula always hides something in [X]: curiosity at the very least
  if (!scores.size) add("curiosity", 1);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d]) => d);
}

const MONTHS = 12;

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function trend(members, now) {
  const months = [];
  for (let i = MONTHS - 1; i >= 0; i--) {
    months.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  const buckets = new Map(months.map((m) => [m, { month: m, uploads: 0, views: 0, multipliers: [] }]));
  for (const { video } of members) {
    const b = buckets.get(monthKey(video.publishedAt));
    if (!b) continue;
    b.uploads += 1;
    b.views += video.views;
    if (video.multiplier != null) b.multipliers.push(video.multiplier);
  }
  return [...buckets.values()].map(({ multipliers, ...b }) => ({
    ...b,
    outlier: multipliers.length ? Number(cappedMean(multipliers).toFixed(2)) : null,
  }));
}

/**
 * Find the formats in `videos` ({ id, title, channelId, multiplier, views,
 * publishedAt: Date, hooks: string[], lang }).
 *
 * Boost: the format's average outlier multiplier divided by the average
 * multiplier of every video in the pool. The multiplier is views ÷ the
 * channel's usual views, so a format used by big channels doesn't win just
 * because they are big; raw views would only measure channel size. Both
 * averages cap multipliers at MULTIPLIER_CAP, and the format's average is
 * taken per channel first so one prolific channel counts once. It is then
 * pulled toward the reference as if PRIOR_CHANNELS average channels used it
 * too: 5 channels and one lucky video can't outrank a format proven by 30.
 */
export function mineTitleFormats(videos, { now = new Date() } = {}) {
  const words = videos.map((v) => titleWords(v.title));
  const wordSets = new Map();
  words.forEach((w, i) => {
    for (const word of w) {
      const lower = word.toLowerCase();
      let set = wordSets.get(lower);
      if (!set) wordSets.set(lower, (set = new Set()));
      set.add(videos[i].channelId);
    }
  });
  const wordChannels = new Map([...wordSets].map(([w, set]) => [w, set.size]));
  wordSets.clear();

  // Pass 1: how many titles share each candidate (just a count, to stay light)
  const support = new Map();
  words.forEach((w) => {
    if (w.length < 3 || w.length > MAX_TITLE_WORDS) return;
    for (const [p, s] of splits(w)) {
      const key = keyOf(w.slice(0, p), w.slice(w.length - s));
      support.set(key, (support.get(key) ?? 0) + 1);
    }
  });
  for (const [key, count] of support) if (count < MIN_VIDEOS) support.delete(key);

  // Pass 2: the titles behind the frequent candidates
  const groups = new Map();
  words.forEach((w, index) => {
    if (w.length < 3 || w.length > MAX_TITLE_WORDS) return;
    const seen = new Set();
    for (const [p, s] of splits(w)) {
      const prefix = w.slice(0, p);
      const suffix = w.slice(w.length - s);
      const key = keyOf(prefix, suffix);
      if (!support.has(key) || seen.has(key)) continue;
      seen.add(key);
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { key, p, s, members: [] }));
      group.members.push({ index, prefix, suffix, slot: w.slice(p, w.length - s) });
    }
  });
  support.clear();

  const candidates = [];
  for (const group of groups.values()) {
    const { members } = group;
    const fixed = [...members[0].prefix, ...members[0].suffix];
    if (!usableFixed(fixed, wordChannels)) continue;
    const perChannel = Map.groupBy(members, (m) => videos[m.index].channelId);
    if (perChannel.size < MIN_CHANNELS) continue;
    if (Math.max(...[...perChannel.values()].map((l) => l.length)) > members.length * MAX_CHANNEL_SHARE) continue;
    const slots = members.map((m) => m.slot.join(" ").toLowerCase());
    if (new Set(slots).size < MIN_VIDEOS) continue;
    // "Episode [X]", "Part [X]": the slot is just a counter
    if (slots.filter((s) => /^[\d\s.#/:-]+$/.test(s)).length > slots.length / 2) continue;
    candidates.push({ ...group, perChannel });
  }
  groups.clear();

  // Most specific first; a format mostly made of titles a kept format explains is a duplicate
  candidates.sort((a, b) => b.p + b.s - (a.p + a.s) || b.members.length - a.members.length);
  const claimed = new Set();
  const kept = [];
  for (const c of candidates) {
    const overlap = c.members.filter((m) => claimed.has(m.index)).length / c.members.length;
    if (overlap > MAX_OVERLAP) continue;
    for (const m of c.members) claimed.add(m.index);
    kept.push(c);
  }

  const pool = videos.map((v) => v.multiplier).filter((m) => m != null && m > 0);
  const reference = pool.length ? cappedMean(pool) : 1;

  const formats = [];
  for (const c of kept) {
    const channelMeans = [];
    for (const list of c.perChannel.values()) {
      const ms = list.map((m) => videos[m.index].multiplier).filter((m) => m != null && m > 0);
      if (ms.length) channelMeans.push(cappedMean(ms));
    }
    if (channelMeans.length < MIN_CHANNELS) continue;
    const performance =
      (channelMeans.reduce((a, b) => a + b, 0) + PRIOR_CHANNELS * reference) / (channelMeans.length + PRIOR_CHANNELS);

    const members = c.members.map((m) => ({ ...m, video: videos[m.index] }));
    const prefix = Array.from({ length: c.p }, (_, i) => mostCommon(members.map((m) => m.prefix[i])));
    const suffix = Array.from({ length: c.s }, (_, i) => mostCommon(members.map((m) => m.suffix[i])));
    const formula = [prefix.join(" "), "[X]", suffix.join(" ")].filter(Boolean).join(" ");

    const hookCounts = new Map();
    for (const m of members) for (const h of m.video.hooks ?? []) hookCounts.set(h, (hookCounts.get(h) ?? 0) + 1);
    const hookShares = [...hookCounts].map(([h, n]) => [h, n / members.length]);

    // Examples: best multipliers, one per channel first
    const ranked = [...members].sort((a, b) => (b.video.multiplier ?? -1) - (a.video.multiplier ?? -1));
    const firstPerChannel = [...new Map(ranked.map((m) => [m.video.channelId, m])).values()];
    const rest = ranked.filter((m) => !firstPerChannel.includes(m));
    const examples = [...firstPerChannel, ...rest].map((m) => ({ id: m.video.id, slot: m.slot.join(" ") }));

    const latest = Math.max(...members.map((m) => m.video.publishedAt.getTime()));
    formats.push({
      id: crypto.createHash("sha1").update(c.key).digest("hex").slice(0, 12),
      formula,
      prefix: prefix.join(" "),
      suffix: suffix.join(" "),
      boost: Number((performance / reference).toFixed(2)),
      videoCount: members.length,
      channelCount: c.perChannel.size,
      lang: mostCommon(members.map((m) => m.video.lang ?? "unknown")),
      latestAt: new Date(latest).toISOString(),
      drivers: clickDrivers(formula, hookShares),
      trend: trend(members, now),
      examples,
    });
  }
  return { formats, reference };
}
