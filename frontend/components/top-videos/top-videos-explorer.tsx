"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Database, Flame, Search } from "lucide-react";
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
} from "@/components/explorer/explorer-ui";
import { localize, useFilterSpec, useUrlFilters } from "@/components/explorer/filter-spec";
import { SpecFilterSection, topOptions, useSpecChips } from "@/components/explorer/spec-filters";
import { InfiniteScroll } from "@/components/explorer/infinite-scroll";
import { useI18n } from "@/components/i18n-provider";
import { OutlierCard, type OutlierVideo } from "./outlier-card";

interface ApiResponse {
  items: OutlierVideo[];
  total: number;
  page: number;
  hasMore: boolean;
  updatedAt: string | null;
}

// Results are tagged with the query they answer, so "loading" is derived instead of set in effects.
type Result = ApiResponse & { key: string };

// Each tab is a baseline over the backend defaults: "all videos" is the whole database, newest first.
const VIEW_OVERRIDES: Record<string, Record<string, string>> = {
  outliers: {},
  all: { period: "all", sort: "recent", relevant: "false" },
};
const UI_PARAMS = ["view"];

export function TopVideosExplorer() {
  const { t, locale } = useI18n();
  const tv = t.topVideos;
  const searchParams = useSearchParams();
  const view =searchParams.get("view") === "all" ? "all" : "outliers";
  const isAllView = view === "all";
  const hidden = isAllView ? ["relevant"] : [];

  const { spec, error: specError, retry: retrySpec } = useFilterSpec("videos");
  const filters = useUrlFilters({ spec, overrides: VIEW_OVERRIDES[view], uiParams: UI_PARAMS });
  const { chips, remove } = useSpecChips(spec, filters, hidden);
  const queryKey = filters.apiParams(0).toString();
  const q = filters.value("q");

  const [search, setSearch] = useState(q);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const loading = result?.key !== queryKey && error?.key !== queryKey;

  const switchView = (next: string) => {
    setSearch("");
    filters.reset([], { view: next === "all" ? "all" : null });
  };

  const resetFilters = () => {
    setSearch("");
    filters.reset(["view", "sort"]);
  };

  // A badge on a card narrows the list to its value.
  const filterOn = (key: string, value: string) => filters.setMany({ [key]: value });

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => filters.setMany({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, q, filters]);

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
    if (!result || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchJson<ApiResponse>(`/api/videos/top?${filters.apiParams(result.page + 1)}`);
      setResult((prev) => (prev && prev.key === queryKey ? { ...data, key: queryKey, items: [...prev.items, ...data.items] } : prev));
    } catch (err) {
      setError({ key: queryKey, error: err as Error });
    } finally {
      setLoadingMore(false);
    }
  };

  const sortOptions = (spec?.sorts ?? []).map((s) => ({ value: s.value, label: localize(s.label, locale) }));
  const items = result?.key === queryKey ? result.items : [];

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{isAllView ? tv.allTitle : tv.title}</h2>
            <p className="text-sm text-muted-foreground">{isAllView ? tv.allDescription : tv.description}</p>
          </div>
          <Tabs value={view} onValueChange={(v) => switchView(String(v))}>
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

        {/* Quick topics: the niches with the most recent videos */}
        {spec && (
          <TopicChips
            topics={topOptions(spec, "niche", 8).map((option) => ({
              label: localize(option.label, locale),
              active: filters.value("niche") === String(option.value),
              onPick: () => {
                setSearch("");
                filters.reset(["view", "sort"], { niche: String(option.value) });
              },
            }))}
          />
        )}

        <SpecFilterSection spec={spec} error={specError} onRetry={retrySpec} filters={filters} hidden={hidden} />

        <ActiveFilters
          chips={chips}
          onRemove={(key) => {
            if (key === "q") setSearch("");
            remove(key);
          }}
          onClear={resetFilters}
        />

        <ResultsBar
          loading={loading}
          total={result?.key === queryKey ? result.total : 0}
          noun={tv.noun}
          updatedAt={result?.updatedAt ?? null}
          sort={
            sortOptions.length > 0 && (
              <FilterSelect
                value={filters.value("sort")}
                options={sortOptions}
                onChange={(v) => filters.setMany({ sort: v })}
                className="w-auto"
              />
            )
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
          <EmptyState title={tv.emptyTitle} description={tv.emptyDescription}>
            <Button variant="outline" size="sm" onClick={resetFilters}>
              {t.common.resetFilters}
            </Button>
          </EmptyState>
        ) : (
          <>
            <Grid>
              {items.map((video) => (
                <OutlierCard key={video.id} video={video} onFilter={filterOn} />
              ))}
            </Grid>
            <InfiniteScroll hasMore={!!result?.hasMore} loading={loadingMore} onLoadMore={loadMore} />
          </>
        )}
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}
