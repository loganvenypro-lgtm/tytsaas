import type { Messages } from "@/lib/i18n";

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

// Defaults applied when switching to the "all videos" tab: whole database, newest first.
export const ALL_VIDEOS_DEFAULTS: Partial<Filters> = { period: "all", sort: "recent", relevant: "false" };

// Channel size buckets, mapped to minSubs/maxSubs for the API.
const SUBS_BUCKETS = [
  { value: "all", min: null, max: null },
  { value: "micro", min: null, max: 10_000 },
  { value: "small", min: 10_000, max: 100_000 },
  { value: "medium", min: 100_000, max: 1_000_000 },
  { value: "large", min: 1_000_000, max: null },
] as const;

// Option lists are built from the messages so their labels follow the interface language;
// the values (what goes in the URL and the API) never change.
export function options<K extends string>(labels: Record<K, string>) {
  // Integer-like keys ("10000") come before "all" in object order; keep "all" first
  const keys = (Object.keys(labels) as K[]).sort((a, b) => Number(b === "all") - Number(a === "all"));
  return keys.map((value) => ({ value, label: labels[value] }));
}

export function filterOptions(t: Messages) {
  const f = t.filters;
  return {
    format: options(f.format),
    period: options(f.period),
    subs: SUBS_BUCKETS.map((b) => ({ ...b, label: f.subs[b.value] })),
    views: options(f.views),
    multiplier: options(f.multiplier),
    category: [
      { value: "all", label: f.allCategories },
      ...Object.entries(t.categories).map(([value, label]) => ({ value, label })),
    ],
    sort: options(f.sort),
  };
}

/** Translate UI filters into /api/videos/top query params. */
export function toApiParams(filters: Filters, page: number): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("format", filters.format);
  params.set("period", filters.period);
  appendSubsParams(params, filters.subs);
  if (filters.minViews !== "all") params.set("minViews", filters.minViews);
  if (filters.minMultiplier !== "all") params.set("minMultiplier", filters.minMultiplier);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.language !== "all") params.set("language", filters.language);
  params.set("sort", filters.sort);
  params.set("relevant", filters.view === "all" ? "false" : filters.relevant);
  params.set("page", String(page));
  return params;
}

export function appendSubsParams(params: URLSearchParams, subs: string) {
  const bucket = SUBS_BUCKETS.find((o) => o.value === subs);
  if (bucket?.min != null) params.set("minSubs", String(bucket.min));
  if (bucket?.max != null) params.set("maxSubs", String(bucket.max));
}
