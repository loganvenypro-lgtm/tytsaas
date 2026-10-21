export type FilterKey =
  | "view"
  | "q"
  | "format"
  | "period"
  | "subs"
  | "minViews"
  | "minMultiplier"
  | "category"
  | "language"
  | "sort"
  | "relevant";

export type Filters = Record<FilterKey, string>;

export const DEFAULT_FILTERS: Filters = {
  view: "outliers",
  q: "",
  format: "all",
  period: "7d",
  subs: "all",
  minViews: "all",
  minMultiplier: "all",
  category: "all",
  language: "all",
  sort: "score",
  relevant: "true",
};

export const PERIOD_OPTIONS = [
  { value: "24h", label: "Dernières 24 h" },
  { value: "3d", label: "3 derniers jours" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
  { value: "all", label: "Toute la base" },
];

// Defaults applied when switching to the "all videos" tab: whole database, newest first.
export const ALL_VIDEOS_DEFAULTS: Partial<Filters> = { period: "all", sort: "recent", relevant: "false" };

// Channel size buckets, mapped to minSubs/maxSubs for the API.
export const SUBS_OPTIONS = [
  { value: "all", label: "Toutes les chaînes", min: null, max: null },
  { value: "micro", label: "< 10 k abonnés", min: null, max: 10_000 },
  { value: "small", label: "10 k – 100 k", min: 10_000, max: 100_000 },
  { value: "medium", label: "100 k – 1 M", min: 100_000, max: 1_000_000 },
  { value: "large", label: "> 1 M abonnés", min: 1_000_000, max: null },
];

export const VIEWS_OPTIONS = [
  { value: "all", label: "Toutes les vues" },
  { value: "10000", label: "10 k vues +" },
  { value: "100000", label: "100 k vues +" },
  { value: "1000000", label: "1 M vues +" },
];

export const MULTIPLIER_OPTIONS = [
  { value: "all", label: "Tout multiplicateur" },
  { value: "2", label: "2x et plus" },
  { value: "3", label: "3x et plus" },
  { value: "5", label: "5x et plus" },
  { value: "10", label: "10x et plus" },
];

export const CATEGORY_LABELS: Record<number, string> = {
  1: "Film & Animation",
  2: "Auto",
  10: "Musique",
  15: "Animaux",
  17: "Sport",
  19: "Voyage",
  20: "Gaming",
  22: "Vlog / People",
  23: "Humour",
  24: "Divertissement",
  25: "Actualité",
  26: "Tutos & Style",
  27: "Éducation",
  28: "Science & Tech",
  29: "Associatif",
};

export const CATEGORY_OPTIONS = [
  { value: "all", label: "Toutes catégories" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "Anglais",
  fr: "Français",
  es: "Espagnol",
  pt: "Portugais",
  de: "Allemand",
  it: "Italien",
  hi: "Hindi",
  ar: "Arabe",
  ru: "Russe",
  zh: "Chinois",
  ja: "Japonais",
  ko: "Coréen",
  id: "Indonésien",
  tr: "Turc",
  ur: "Ourdou",
  bn: "Bengali",
  ta: "Tamoul",
  mr: "Marathi",
  zxx: "Sans parole",
};

export const SORT_OPTIONS = [
  { value: "score", label: "Pertinence" },
  { value: "multiplier", label: "Multiplicateur" },
  { value: "views", label: "Vues" },
  { value: "velocity", label: "Vitesse (vues/h)" },
  { value: "recent", label: "Plus récentes" },
];

export const FORMAT_OPTIONS = [
  { value: "all", label: "Tout" },
  { value: "long", label: "Vidéos longues" },
  { value: "short", label: "Shorts" },
];

/** Translate UI filters into /api/videos/top query params. */
export function toApiParams(filters: Filters, page: number): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("format", filters.format);
  params.set("period", filters.period);
  const subs = SUBS_OPTIONS.find((o) => o.value === filters.subs);
  if (subs?.min != null) params.set("minSubs", String(subs.min));
  if (subs?.max != null) params.set("maxSubs", String(subs.max));
  if (filters.minViews !== "all") params.set("minViews", filters.minViews);
  if (filters.minMultiplier !== "all") params.set("minMultiplier", filters.minMultiplier);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.language !== "all") params.set("language", filters.language);
  params.set("sort", filters.sort);
  params.set("relevant", filters.view === "all" ? "false" : filters.relevant);
  params.set("page", String(page));
  return params;
}
