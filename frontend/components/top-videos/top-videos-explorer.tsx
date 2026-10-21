"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Database, Flame, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ActiveFilters,
  EmptyState,
  FilterSelect,
  ResultsBar,
  SessionExpiredError,
  SessionExpiredState,
  TopicChips,
  fetchJson,
  type ActiveChip,
  type Option,
} from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import type { Messages } from "@/lib/i18n";
import {
  ALL_VIDEOS_DEFAULTS,
  DEFAULT_FILTERS,
  filterOptions,
  toApiParams,
  type FilterKey,
  type Filters,
} from "./filter-options";
import { OutlierCard, type OutlierVideo } from "./outlier-card";
import { OutlierFilters } from "./outlier-filters";

interface ApiResponse {
  items: OutlierVideo[];
  total: number;
  page: number;
  hasMore: boolean;
  languages: { code: string; count: number }[];
  updatedAt: string | null;
}

// Results are tagged with the query they answer, so "loading" is derived instead of set in effects.
type Result = ApiResponse & { key: string };

// Quick topics: each one is just a preset of filters.
const TOPICS: { key: keyof Messages["topVideos"]["topics"]; filters: Partial<Filters> }[] = [
  { key: "gaming", filters: { category: "20" } },
  { key: "documentaries", filters: { q: "documentary" } },
  { key: "minecraft", filters: { q: "minecraft" } },
  { key: "trueCrime", filters: { q: "crime" } },
  { key: "education", filters: { category: "27" } },
  { key: "scienceTech", filters: { category: "28" } },
  { key: "comedy", filters: { category: "23" } },
  { key: "sports", filters: { category: "17" } },
];

function baselineFor(view: string): Filters {
  return view === "all" ? { ...DEFAULT_FILTERS, ...ALL_VIDEOS_DEFAULTS, view: "all" } : { ...DEFAULT_FILTERS };
}

function readFilters(params: URLSearchParams): Filters {
  const filters = baselineFor(params.get("view") === "all" ? "all" : "outliers");
  for (const key of Object.keys(DEFAULT_FILTERS) as FilterKey[]) {
    const value = params.get(key);
    if (value) filters[key] = value;
  }
  return filters;
}

export function TopVideosExplorer() {
  const { t, language: languageName } = useI18n();
  const tv = t.topVideos;
  const opts = filterOptions(t);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => readFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const queryKey = toApiParams(filters, 0).toString();
  const baseline = baselineFor(filters.view);

  const [search, setSearch] = useState(filters.q);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const loading = result?.key !== queryKey && error?.key !== queryKey;

  // Only values that differ from the tab's defaults go in the URL, so links stay short and shareable.
  const updateFilters = useCallback(
    (next: Filters) => {
      const base = baselineFor(next.view);
      const params = new URLSearchParams();
      if (next.view === "all") params.set("view", "all");
      for (const key of Object.keys(DEFAULT_FILTERS) as FilterKey[]) {
        if (key !== "view" && next[key] !== base[key]) params.set(key, next[key]);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setFilter = (key: FilterKey, value: string) => updateFilters({ ...filters, [key]: value });

  const switchView = (view: string) => {
    setSearch("");
    updateFilters(baselineFor(view));
  };

  const resetFilters = () => {
    setSearch("");
    updateFilters({ ...baseline, sort: filters.sort });
  };

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => updateFilters({ ...filters, q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, filters, updateFilters]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ApiResponse>(`/api/videos/top?${queryKey}`)
      .then((data) => !cancelled && setResult({ ...data, key: queryKey }))
      .catch((err: Error) => !cancelled && setError({ key: queryKey, error: err }));
    return () => {
      cancelled = true;
    };
  }, [queryKey, reloadToken]);

  const loadMore = async () => {
    if (!result) return;
    setLoadingMore(true);
    try {
      const data = await fetchJson<ApiResponse>(`/api/videos/top?${toApiParams(filters, result.page + 1)}`);
      setResult((prev) => (prev && prev.key === queryKey ? { ...data, key: queryKey, items: [...prev.items, ...data.items] } : prev));
    } catch (err) {
      setError({ key: queryKey, error: err as Error });
    } finally {
      setLoadingMore(false);
    }
  };

  const languageOptions: Option[] = [
    { value: "all", label: t.explorer.allLanguages },
    ...(result?.languages ?? []).map((l) => ({ value: l.code, label: languageName(l.code) })),
  ];
  if (filters.language !== "all" && !languageOptions.some((o) => o.value === filters.language)) {
    languageOptions.push({ value: filters.language, label: languageName(filters.language) });
  }

  // Removable chips for every filter that differs from the tab's defaults.
  const labelOf = (options: Option[], value: string) => options.find((o) => o.value === value)?.label ?? value;
  const chipSources: [FilterKey, Option[]][] = [
    ["format", opts.format],
    ["period", opts.period],
    ["category", opts.category],
    ["language", languageOptions],
    ["subs", opts.subs],
    ["minViews", opts.views],
    ["minMultiplier", opts.multiplier],
  ];
  const chips: ActiveChip[] = [];
  if (filters.q) chips.push({ key: "q", label: t.common.quoted(filters.q) });
  for (const [key, options] of chipSources) {
    if (filters[key] !== baseline[key]) chips.push({ key, label: labelOf(options, filters[key]) });
  }
  if (filters.view !== "all" && filters.relevant !== baseline.relevant) {
    chips.push({ key: "relevant", label: tv.unfilteredChip });
  }

  const items = result?.key === queryKey ? result.items : [];
  const isAllView = filters.view === "all";

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              {isAllView ? tv.allTitle : tv.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAllView
                ? tv.allDescription
                : tv.description}
            </p>
          </div>
          <Tabs value={filters.view} onValueChange={(v) => switchView(String(v))}>
            <TabsList>
              <TabsTrigger value="outliers">
                <Flame className="size-3.5" />
                {tv.tabOutliers}
              </TabsTrigger>
              <TabsTrigger value="all">
                <Database className="size-3.5" />
                {tv.tabAll}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tv.searchPlaceholder}
            className="h-10 pl-9"
          />
        </div>

        <TopicChips
          topics={TOPICS.map((topic) => ({
            label: tv.topics[topic.key],
            active: Object.entries(topic.filters).every(([k, v]) => filters[k as FilterKey] === v),
            onPick: () => {
              setSearch(topic.filters.q ?? "");
              updateFilters({ ...baseline, sort: filters.sort, ...topic.filters });
            },
          }))}
        />

        <OutlierFilters filters={filters} languageOptions={languageOptions} onChange={setFilter} />

        <ActiveFilters
          chips={chips}
          onRemove={(key) => {
            if (key === "q") setSearch("");
            setFilter(key as FilterKey, baseline[key as FilterKey]);
          }}
          onClear={resetFilters}
        />

        <ResultsBar
          loading={loading}
          total={result?.key === queryKey ? result.total : 0}
          noun={tv.noun}
          updatedAt={result?.updatedAt ?? null}
          sort={
            <FilterSelect value={filters.sort} options={opts.sort} onChange={(v) => setFilter("sort", v)} className="w-auto" />
          }
        />

        {error?.key === queryKey ? (
          error.error instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title={tv.loadError} description={t.common.loadErrorHint}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setReloadToken((n) => n + 1);
                }}
              >
                {t.common.retry}
              </Button>
            </EmptyState>
          )
        ) : loading ? (
          <Grid>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-xl border">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="flex flex-col gap-2 p-3.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </Grid>
        ) : items.length === 0 ? (
          <EmptyState
            title={tv.emptyTitle}
            description={tv.emptyDescription}
          >
            <Button variant="outline" size="sm" onClick={resetFilters}>
              {t.common.resetFilters}
            </Button>
          </EmptyState>
        ) : (
          <>
            <Grid>
              {items.map((video) => (
                <OutlierCard key={video.id} video={video} />
              ))}
            </Grid>
            {result?.hasMore && (
              <div className="flex justify-center pb-4">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="size-4 animate-spin" />}
                  {t.common.showMore}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}
