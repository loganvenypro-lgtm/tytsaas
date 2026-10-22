"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Messages } from "@/lib/i18n";
import { ChannelCard, type TrendChannel } from "./channel-card";
import { SimilarChannelsDialog } from "./similar-channels-dialog";

type Variant = "trends" | "finder";

// Both pages list the same channels (one backend spec); a variant only changes the
// default sort and its quick presets, written with the API's own param names.
const VARIANTS: {
  trends: { overrides: Record<string, string>; niches: number; presets: { key: keyof Messages["breakout"]["trends"]["topics"]; params: Record<string, string> }[] };
  finder: { overrides: Record<string, string>; niches: number; presets: { key: keyof Messages["breakout"]["finder"]["topics"]; params: Record<string, string> }[] };
} = {
  trends: {
    overrides: {},
    niches: 6,
    presets: [{ key: "emerging", params: { minSubs: "10000", maxSubs: "100000", withOutliers: "true" } }],
  },
  finder: {
    overrides: { sort: "opportunity" },
    niches: 3,
    presets: [
      { key: "under6m", params: { maxAgeDays: "180" } },
      { key: "regularHits", params: { minOutlierRate: "20" } },
      { key: "smallBreaking", params: { maxSubs: "10000", minOutlierRate: "10" } },
      { key: "shorts", params: { format: "short" } },
      { key: "long", params: { format: "long" } },
    ],
  },
};

interface ApiResponse {
  items: TrendChannel[];
  total: number;
  page: number;
  hasMore: boolean;
  updatedAt: string | null;
}

export function BreakoutExplorer({ variant = "trends" }: { variant?: Variant }) {
  const config = VARIANTS[variant];
  const { t, locale } = useI18n();
  const tb = t.breakout;
  const labels = tb[variant];
  const topicLabels: Record<string, string> = labels.topics;

  const { spec, error: specError, retry: retrySpec } = useFilterSpec("channels");
  const filters = useUrlFilters({ spec, overrides: config.overrides });
  const { chips, remove } = useSpecChips(spec, filters);
  const queryKey = filters.apiParams(0).toString();
  const q = filters.value("q");

  const [search, setSearch] = useState(q);
  const [result, setResult] = useState<(ApiResponse & { key: string }) | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [similarOf, setSimilarOf] = useState<{ id: string; name: string } | null>(null);
  const loading = result?.key !== queryKey && error?.key !== queryKey;

  const reset = (params: Record<string, string> = {}) => {
    setSearch("");
    filters.reset(["sort"], params);
  };
  const filterOn = (key: string, value: string) => filters.setMany({ [key]: value });

  useEffect(() => {
    if (search === q) return;
    const timer = setTimeout(() => filters.setMany({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, q, filters]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ApiResponse>(`/api/channels/breakout?${queryKey}`)
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
      const data = await fetchJson<ApiResponse>(`/api/channels/breakout?${filters.apiParams(result.page + 1)}`);
      setResult((prev) => (prev && prev.key === queryKey ? { ...data, key: queryKey, items: [...prev.items, ...data.items] } : prev));
    } catch (err) {
      setError({ key: queryKey, error: err as Error });
    } finally {
      setLoadingMore(false);
    }
  };

  // Quick topics: the variant's presets, then the niches with the most channels.
  const topics = [
    ...config.presets.map((preset) => ({ label: topicLabels[preset.key], params: preset.params })),
    ...topOptions(spec, "niche", config.niches).map((option) => ({
      label: localize(option.label, locale),
      params: { niche: String(option.value) },
    })),
  ];
  const sortOptions = (spec?.sorts ?? []).map((s) => ({ value: s.value, label: localize(s.label, locale) }));
  const items = result?.key === queryKey ? result.items : [];

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{labels.title}</h2>
          <p className="text-sm text-muted-foreground">{labels.description}</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tb.searchPlaceholder}
            className="h-10 pl-9"
          />
        </div>

        <TopicChips
          topics={topics.map((topic) => ({
            label: topic.label,
            active: Object.entries(topic.params).every(([param, v]) => filters.value(param) === v),
            onPick: () => reset(topic.params),
          }))}
        />

        <SpecFilterSection spec={spec} error={specError} onRetry={retrySpec} filters={filters} />

        <ActiveFilters
          chips={chips}
          onRemove={(key) => {
            if (key === "q") setSearch("");
            remove(key);
          }}
          onClear={() => reset()}
        />

        <ResultsBar
          loading={loading}
          total={result?.key === queryKey ? result.total : 0}
          noun={tb.noun}
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
            <EmptyState title={tb.loadError} description={t.common.loadErrorHint}>
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[440px] rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={tb.emptyTitle} description={tb.emptyDescription}>
            <Button variant="outline" size="sm" onClick={() => reset()}>
              {t.common.resetFilters}
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {items.map((channel, i) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  rank={i + 1}
                  variant={variant}
                  onSimilar={() => setSimilarOf({ id: channel.id, name: channel.name })}
                  onFilter={filterOn}
                />
              ))}
            </div>
            <InfiniteScroll hasMore={!!result?.hasMore} loading={loadingMore} onLoadMore={loadMore} />
          </>
        )}
      </div>

      <SimilarChannelsDialog channel={similarOf} onOpenChange={(open) => !open && setSimilarOf(null)} />
    </div>
  );
}
