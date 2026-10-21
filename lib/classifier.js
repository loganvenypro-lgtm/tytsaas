/**
 * Video and channel classifier: niche, sub-niche, format, title hooks, language.
 * Pure functions over the taxonomy in lib/taxonomy, no I/O, so the worker can
 * classify tens of thousands of rows per minute and the API can reuse it.
 *
 * Signals, strongest first:
 *   - title (full weight), tags (60 %, capped), description start (40 %, capped)
 *   - YouTube topicDetails (Wikipedia topics) and category id
 *   - the channel's own niche, as a prior proportional to its confidence
 */
import {
  NICHES, NICHE_BY_ID, TOPIC_INDEX, FORMATS, FORMAT_BY_ID, FORMAT_MIN_SCORE, HOOKS,
} from "./taxonomy/index.js";

const NICHE_MIN_SCORE = 3.5;
const SUB_NICHE_MIN_SCORE = 3;

const compile = (terms) =>
  terms.map(([src, weight]) => ({
    re: new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${src})(?=$|[^\\p{L}\\p{N}])`, "iu"),
    weight,
  }));

const COMPILED_NICHES = NICHES.map((n) => ({
  id: n.id,
  rules: compile(n.terms),
  categories: n.categories,
  subNiches: n.subNiches.map((s) => ({ id: s.id, rules: compile(s.terms) })),
}));

const COMPILED_FORMATS = FORMATS.map((f) => ({ ...f, rules: compile(f.terms) }));

function scoreRules(rules, text) {
  if (!text) return 0;
  let score = 0;
  for (const { re, weight } of rules) if (re.test(text)) score += weight;
  return score;
}

/** Map of nicheId -> score for one piece of text. */
function nicheScores(text) {
  const scores = new Map();
  if (!text) return scores;
  for (const niche of COMPILED_NICHES) {
    const s = scoreRules(niche.rules, text);
    if (s > 0) scores.set(niche.id, s);
  }
  return scores;
}

const addInto = (target, source, factor = 1, cap = Infinity) => {
  for (const [id, s] of source) target.set(id, (target.get(id) ?? 0) + Math.min(s * factor, cap));
};

/** Wikipedia topic URLs (topicDetails.topicCategories) -> slugs. */
export function topicSlugs(urls) {
  return (urls ?? []).map((u) => String(u).split("/wiki/").pop()).filter(Boolean);
}

function topicScores(topics) {
  const scores = new Map();
  for (const slug of topics ?? []) {
    for (const [id, weight] of TOPIC_INDEX.get(String(slug).toLowerCase()) ?? []) {
      scores.set(id, (scores.get(id) ?? 0) + weight);
    }
  }
  return scores;
}

function best(scores) {
  let id = null;
  let top = 0;
  let second = 0;
  let sum = 0;
  for (const [key, s] of scores) {
    sum += s;
    if (s > top) [id, top, second] = [key, s, top];
    else if (s > second) second = s;
  }
  return { id, top, second, sum };
}

function cleanDescription(description, max) {
  return (description ?? "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#\w+/g, " ")
    .slice(0, max);
}

function subNicheOf(nicheId, text) {
  const niche = COMPILED_NICHES.find((n) => n.id === nicheId);
  if (!niche) return null;
  let id = null;
  let top = 0;
  for (const sub of niche.subNiches) {
    const s = scoreRules(sub.rules, text);
    if (s > top) [id, top] = [sub.id, s];
  }
  return top >= SUB_NICHE_MIN_SCORE ? id : null;
}

// ---------------------------------------------------------------------------
// Format and hooks
// ---------------------------------------------------------------------------

export function detectFormat({ title, tags, durationSeconds, isShort, isLivestream, categoryId }) {
  if (isLivestream) return "livestream";
  const text = `${title ?? ""} ${(tags ?? []).slice(0, 15).join(" ")}`;
  const duration = Number(durationSeconds ?? 0);
  let id = null;
  let top = 0;
  for (const f of COMPILED_FORMATS) {
    if (f.id === "livestream") continue;
    if (f.minSeconds && (isShort || (duration > 0 && duration < f.minSeconds))) continue;
    if (f.maxSeconds && duration > f.maxSeconds) continue;
    let s = scoreRules(f.rules, title) + Math.min(scoreRules(f.rules, text) * 0.3, 2);
    if (s === 0) continue;
    if (f.longBonus && duration >= f.longBonus[0]) s += f.longBonus[1];
    s += f.categories?.[categoryId] ?? 0;
    if (s > top) [id, top] = [f.id, s];
  }
  return top >= FORMAT_MIN_SCORE ? id : null;
}

export function detectHooks(title) {
  if (!title) return [];
  return HOOKS.filter((h) => h.re.test(title)).map((h) => h.id);
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

const STOPWORDS = {
  en: "the and you that this with for are was what how why your have from they not but when will just about my his her their don't can't i'm it's we were there been would",
  fr: "le la les des une est pour pas que qui dans avec sur mais vous nous ils elle sont été cette ces très aussi comment pourquoi j'ai c'est je tu mon ma mes du au aux",
  es: "el la los las una por para con que del pero como más este esta muy son está porque cuando también sus hay sobre todo yo mi qué cómo",
  pt: "o os as um uma por para com que não mais como mas foi são está isso você muito também quando seu sua eu meu minha então já",
  de: "der die das und ist nicht ein eine mit auf für ich sie es den dem sich auch wie was wir aber noch nur oder warum wenn mein dein",
  it: "il lo la gli le una per con che non sono questo questa come più anche perché quando mio mia della nel ho hai",
  // Words shared with other languages ("de", "da", "i", "to", "dan"…) are left out on purpose.
  nl: "het een niet zijn voor maar waarom ook mijn dit wat hoe ik je dat van",
  tr: "bir ve bu için ile çok ben sen nasıl neden gibi daha var yok",
  pl: "nie się jest że jak ale czy dla jestem mój",
  id: "yang ini itu dengan untuk tidak dari ada aku kamu saya bisa",
  vi: "và của là có không những được một người cho này với các trong",
};
const STOPWORD_SETS = Object.fromEntries(Object.entries(STOPWORDS).map(([k, v]) => [k, new Set(v.split(/\s+/))]));

const SCRIPTS = [
  ["ja", /[぀-ヿ]/gu],
  ["ko", /[가-힯]/gu],
  ["zh", /[一-鿿]/gu],
  ["ru", /[Ѐ-ӿ]/gu],
  ["ar", /[؀-ۿ]/gu],
  ["hi", /[ऀ-ॿ]/gu],
  ["th", /[฀-๿]/gu],
];
const FR_ACCENTS = /[éèêàçùœ]/giu;
const ES_PT_MARKS = /[ñ¿¡]|ção|ões|ã/giu;
const DE_MARKS = /[äöüß]/giu;

/** ISO 639-1 code detected from text, or null when the text is too short to tell. */
export function detectLanguage(text) {
  if (!text) return null;
  const letters = text.replace(/[^\p{L}]/gu, "").length || 1;
  for (const [code, re] of SCRIPTS) {
    const n = text.match(re)?.length ?? 0;
    // Japanese uses kanji too: kana anywhere means Japanese.
    if (code === "ja" ? n > 0 : n / letters > 0.3) return code;
  }
  const words = text.toLowerCase().replace(/[^\p{L}' ]+/gu, " ").split(/\s+/).filter(Boolean);
  const scores = new Map();
  for (const w of words) {
    for (const [code, set] of Object.entries(STOPWORD_SETS)) if (set.has(w)) scores.set(code, (scores.get(code) ?? 0) + 1);
  }
  scores.set("fr", (scores.get("fr") ?? 0) + Math.min(2, (text.match(FR_ACCENTS)?.length ?? 0) * 0.5));
  scores.set("de", (scores.get("de") ?? 0) + Math.min(2, (text.match(DE_MARKS)?.length ?? 0) * 0.7));
  const iberian = text.match(ES_PT_MARKS)?.length ?? 0;
  if (iberian) {
    scores.set("es", (scores.get("es") ?? 0) + Math.min(1.5, iberian * 0.5));
    scores.set("pt", (scores.get("pt") ?? 0) + Math.min(1.5, iberian * 0.5));
  }
  const { id, top, second } = best(scores);
  if (!id) return null;
  // At least two signals, and clearly ahead of the runner-up.
  return top >= 2 && top >= second * 1.5 ? id : null;
}

const NON_LATIN = new Set(SCRIPTS.map(([code]) => code));

/**
 * Language of a video from its title, helped by the description. The title's
 * script wins: a Latin title with a Hindi description is not a Hindi video.
 */
function textLanguage(title, description) {
  const fromTitle = detectLanguage(title);
  if (fromTitle) return fromTitle;
  const combined = detectLanguage(`${title} ${description.slice(0, 250)}`);
  if (!combined) return null;
  const titleIsLatin = /\p{Script=Latin}/u.test(title) && !SCRIPTS.some(([, re]) => (title.match(re)?.length ?? 0) > 0);
  return NON_LATIN.has(combined) === !titleIsLatin ? combined : null;
}

/** "en-US" -> "en"; YouTube sometimes returns "zxx" (no linguistic content). */
export function normalizeLanguage(code) {
  const base = String(code ?? "").toLowerCase().split(/[-_]/)[0];
  return base && base !== "zxx" && base !== "und" ? base : null;
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

/**
 * @param video { title, description, tags, topics (slugs), categoryId, durationSeconds, isShort, isLivestream, language }
 * @param channel { niche, subNiche, confidence, lang } or null
 */
export function classifyVideo(video, channel = null) {
  const title = video.title ?? "";
  const tagsText = (video.tags ?? []).slice(0, 20).join(" ");
  const description = cleanDescription(video.description, 400);

  const scores = nicheScores(title);
  addInto(scores, nicheScores(tagsText), 0.6, 6);
  addInto(scores, nicheScores(description), 0.4, 4);
  addInto(scores, topicScores(video.topics));
  for (const niche of COMPILED_NICHES) {
    const prior = niche.categories[video.categoryId];
    if (prior) scores.set(niche.id, (scores.get(niche.id) ?? 0) + prior);
  }
  const channelConfidence = channel?.niche ? Number(channel.confidence ?? 0) : 0;
  if (channelConfidence > 0) {
    scores.set(channel.niche, (scores.get(channel.niche) ?? 0) + Math.min(5, 6 * channelConfidence));
  }

  let { id: niche, top, second, sum } = best(scores);
  let confidence = sum > 0 ? top / sum : 0;
  if (!niche || top < NICHE_MIN_SCORE || top < second * 1.2) {
    // Not enough on its own: inherit the channel's niche when the channel is clear-cut.
    if (channelConfidence >= 0.45) {
      niche = channel.niche;
      confidence = channelConfidence * 0.7;
    } else {
      niche = null;
      confidence = 0;
    }
  }

  const subText = `${title} ${tagsText} ${description}`;
  let subNiche = niche ? subNicheOf(niche, subText) : null;
  if (!subNiche && niche && channel?.niche === niche) subNiche = channel.subNiche ?? null;

  const language = normalizeLanguage(video.language) ?? textLanguage(title, description) ?? channel?.lang ?? null;

  return {
    niche,
    subNiche,
    confidence: Math.round(confidence * 100) / 100,
    format: detectFormat(video),
    hooks: detectHooks(title),
    lang: language,
  };
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

/**
 * Classify a channel from its recent videos and its own metadata.
 * Each title votes with at most 8 points so one keyword-stuffed title cannot
 * decide; topics and the about text add a capped signal.
 *
 * @param input { name, description, keywords, topics (slugs), videos: [{ title, tags, categoryId, format, lang, isShort }] }
 */
export function classifyChannel(input) {
  const videos = (input.videos ?? []).filter((v) => v.title);
  const totals = new Map();
  const hits = new Map();
  const subTexts = [];
  for (const v of videos) {
    const s = nicheScores(v.title);
    addInto(s, nicheScores((v.tags ?? []).slice(0, 15).join(" ")), 0.5, 4);
    for (const [id, score] of s) {
      totals.set(id, (totals.get(id) ?? 0) + Math.min(score, 8));
      hits.set(id, (hits.get(id) ?? 0) + 1);
    }
    subTexts.push(v.title);
  }

  const metaWeight = Math.max(1, videos.length / 8);
  const meta = nicheScores(`${input.name ?? ""} ${input.keywords ?? ""} ${cleanDescription(input.description, 1500)}`);
  addInto(totals, meta, metaWeight / 2, 12 * metaWeight);
  addInto(totals, topicScores(input.topics), metaWeight);

  const categoryCounts = countBy(videos.map((v) => v.categoryId).filter((c) => c != null));
  for (const niche of COMPILED_NICHES) {
    for (const [category, count] of categoryCounts) {
      const prior = niche.categories[category];
      if (prior) totals.set(niche.id, (totals.get(niche.id) ?? 0) + prior * count * 0.5);
    }
  }

  const { id, top, sum } = best(totals);
  const minScore = Math.max(4, videos.length * 0.6);
  const confidence = sum > 0 ? top / sum : 0;
  const coverage = videos.length ? (hits.get(id) ?? 0) / videos.length : 0;
  // One keyword-stuffed upload doesn't make a niche: it needs two titles, or the
  // channel's own name / keywords / about text.
  const supported = (hits.get(id) ?? 0) >= Math.min(2, videos.length) || (meta.get(id) ?? 0) >= 4;
  const valid = id && top >= minScore && supported;

  // Sub-niche: the one most titles of the channel point to.
  let subNiche = null;
  if (valid) {
    const subVotes = new Map();
    for (const text of [...subTexts, `${input.name ?? ""} ${input.keywords ?? ""}`]) {
      const sub = subNicheOf(id, text);
      if (sub) subVotes.set(sub, (subVotes.get(sub) ?? 0) + 1);
    }
    subNiche = best(subVotes).id;
  }

  return {
    niche: valid ? id : null,
    subNiche,
    // Blend of dominance among niches and share of videos that mention it.
    confidence: valid ? Math.round(Math.min(1, confidence * 0.6 + coverage * 0.6) * 100) / 100 : 0,
    coverage: Math.round(coverage * 100) / 100,
    primaryFormat: mode(videos.map((v) => v.format).filter(Boolean), 0.2),
    lang: mode(videos.map((v) => v.lang).filter(Boolean), 0.4) ?? detectLanguage(`${input.name ?? ""} ${input.description ?? ""}`),
    categoryId: mode(videos.map((v) => v.categoryId).filter((c) => c != null)),
    shortShare: videos.length ? videos.filter((v) => v.isShort).length / videos.length : null,
    scores: Object.fromEntries(totals),
  };
}

function countBy(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/** Most frequent value, if it covers at least `minShare` of the values. */
function mode(values, minShare = 0) {
  if (!values.length) return null;
  const { id, top } = best(countBy(values));
  return top / values.length >= minShare ? id : null;
}

// ---------------------------------------------------------------------------
// Helpers kept for the explore API (similar channels)
// ---------------------------------------------------------------------------

/** True when the title on its own clearly belongs to the niche. */
export function titleMatchesNiche(title, nicheId, minScore = 4) {
  const scores = nicheScores(title);
  const own = scores.get(nicheId) ?? 0;
  if (own < minScore) return false;
  for (const [other, s] of scores) if (other !== nicheId && s > own) return false;
  return true;
}

export function nicheLabel(id, locale = "fr") {
  return NICHE_BY_ID[id]?.label[locale] ?? null;
}

export function formatLabel(id, locale = "fr") {
  return FORMAT_BY_ID[id]?.label[locale] ?? null;
}
