/**
 * Monetization benchmarks used by lib/monetization.js. Estimates only: YouTube
 * never says whether a channel earns ads, so the app shows Partner Program
 * eligibility and a revenue range, never an observed status.
 */

/** YouTube Partner Program thresholds (2024+). */
export const YPP = {
  full: { subscribers: 1000, watchHours: 4000, shortsViews90d: 10_000_000 },
  // Expanded YPP (fan funding, Shopping): also needs 3 public uploads in 90 days.
  early: { subscribers: 500, watchHours: 3000, shortsViews90d: 3_000_000, uploads90d: 3 },
};

/**
 * Creator RPM for long-form views (USD per 1,000 views, US-weighted audience),
 * per niche id of lib/taxonomy/niches.js: [low, typical, high].
 */
export const NICHE_RPM = {
  business_ecommerce: [6, 11, 22],
  finance_investing: [8, 14, 30],
  tech_ai: [4, 8, 16],
  true_crime: [3, 5, 9],
  history_documentary: [3, 5.5, 10],
  science_education: [3.5, 6.5, 12],
  gaming: [1.5, 3, 6],
  challenges_entertainment: [2, 4, 8],
  self_improvement: [3, 6, 11],
  fitness_health: [3, 5.5, 10],
  sports: [2.5, 4.5, 9],
  news_politics: [2, 4, 8],
  autos_vehicles: [4, 7, 14],
  comedy: [1.2, 2.6, 5],
  stories_narration: [1.5, 3, 6],
  food_cooking: [2.5, 5, 9],
  film_tv_anime: [1.5, 3.5, 7],
  music: [0.8, 1.8, 4],
  diy_home: [3.5, 6.5, 12],
  animals_nature: [2, 4, 8],
  travel_outdoors: [3, 5.5, 10],
  beauty_fashion: [2.5, 5, 10],
  creators_streamers: [1.5, 3, 6],
  // Made-for-kids content gets no personalized ads.
  family_kids: [0.5, 1.5, 3],
  spirituality_religion: [2, 4, 8],
  asmr_relaxation: [1.5, 3, 6],
};
export const DEFAULT_RPM = [2.5, 4.5, 8.5];

/** Shorts are paid from a shared pool, roughly the same in every niche. */
export const SHORTS_RPM = [0.03, 0.06, 0.1];

/**
 * RPM of the audience's market relative to the US-weighted benchmarks. The
 * channel's language is the best proxy available for where its viewers are.
 */
export const LANGUAGE_RPM_FACTOR = {
  en: 1, de: 0.85, nl: 0.75, ja: 0.7, fr: 0.6, ko: 0.6, it: 0.5, pl: 0.35, es: 0.35,
  ar: 0.3, pt: 0.3, th: 0.25, tr: 0.2, vi: 0.15, ru: 0.15, id: 0.15, hi: 0.12, zh: 0.3,
};
export const DEFAULT_LANGUAGE_FACTOR = 0.5;

/**
 * Average share of a long-form video that is watched, by duration (seconds).
 * Industry averages; used to turn views into watch hours.
 */
export const AVERAGE_VIEW_SHARE = [
  [240, 0.55],
  [480, 0.45],
  [900, 0.38],
  [1800, 0.32],
  [3600, 0.25],
  [Infinity, 0.15],
];

/** Status ids, with labels for the API. */
export const YPP_STATUSES = {
  eligible: { en: "Partner Program eligible", fr: "Éligible au Programme Partenaire" },
  early: { en: "Expanded YPP eligible", fr: "Éligible au YPP étendu" },
  not_eligible: { en: "Not eligible yet", fr: "Pas encore éligible" },
};
