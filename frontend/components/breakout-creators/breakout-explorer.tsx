"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Globe, LayoutGrid, Loader2, Search, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { appendSubsParams, filterOptions, options } from "@/components/top-videos/filter-options";
import type { Messages } from "@/lib/i18n";
import { ChannelCard, type TrendChannel } from "./channel-card";
import { SimilarChannelsSheet } from "./similar-channels-sheet";

type Key = "q" | "format" | "category" | "language" | "subs" | "age" | "hitRate" | "withOutliers" | "sort";
type Filters = Record<Key, string>;
type Variant = "trends" | "finder";

const BASE_DEFAULTS: Omit<Filters, "sort"> = {
  q: "",
  format: "all",
  category: "all",
  language: "all",
  subs: "all",
  age: "all",
  hitRate: "all",
  withOutliers: "false",
};

const AGE_DAYS: Record<string, number> = { "3m": 90, "6m": 180, "1y": 365, "2y": 730 };
const HIT_RATES: Record<string, number> = { "10": 0.1, "20": 0.2, "30": 0.3 };

// Labels (title, sorts, topics) come from t.breakout[variant]
const VARIANTS: {
  trends: { defaultSort: string; topics: { key: keyof Messages["breakout"]["trends"]["topics"]; filters: Partial<Filters> }[] };
  finder: { defaultSort: string; topics: { key: keyof Messages["breakout"]["finder"]["topics"]; filters: Partial<Filters> }[] };
} = {
  trends: {
    defaultSort: "trend",
    topics: [
      { key: "gaming", filters: { category: "20" } },
      { key: "education", filters: { category: "27" } },
      { key: "scienceTech", filters: { category: "28" } },
      { key: "entertainment", filters: { category: "24" } },
      { key: "comedy", filters: { category: "23" } },
      { key: "sports", filters: { category: "17" } },
      { key: "emerging", filters: { subs: "small", withOutliers: "true" } },
    ],
  },
  finder: {
    defaultSort: "opportunity",
    topics: [
      { key: "under6m", filters: { age: "6m" } },
      { key: "regularHits", filters: { hitRate: "20" } },
      { key: "smallBreaking", filters: { subs: "micro", hitRate: "10" } },
      { key: "shorts", filters: { format: "short" } },
      { key: "long", filters: { format: "long" } },
      { key: "gaming", filters: { category: "20" } },
      { key: "education", filters: { category: "27" } },
    ],
  },
};

interface ApiResponse {
  items: TrendChannel[];
  total: number;
  page: number;
  hasMore: boolean;
  languages: { code: string; count: number }[];
  updatedAt: string | null;
}

function toApiParams(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("format", filters.format);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.language !== "all") params.set("language", filters.language);
  appendSubsParams(params, filters.subs);
  if (AGE_DAYS[filters.age]) params.set("maxAgeDays", String(AGE_DAYS[filters.age]));
  if (HIT_RATES[filters.hitRate]) params.set("minOutlierRate", String(HIT_RATES[filters.hitRate]));
  if (filters.withOutliers === "true") params.set("withOutliers", "true");
  params.set("sort", filters.sort);
  params.set("page", String(page));
  return params;
}

export function BreakoutExplorer({ variant = "trends" }: { variant?: Variant }) {
  const config = VARIANTS[variant];
  const { t, language: languageName } = useI18n();
  const tb = t.breakout;
  const labels = tb[variant];
  const opts = filterOptions(t);
  const ageOptions = options(tb.age);
  const hitRateOptions = options(tb.hitRate);
  const topicLabels: Record<string, string> = labels.topics;
  const sortOptions = options<string>(labels.sort);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaults: Filters = useMemo(() => ({ ...BASE_DEFAULTS, sort: config.defaultSort }), [config.defaultSort]);
  const filters = useMemo(() => {
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as Key[]) next[key] = searchParams.get(key) || defaults[key];
    return next;
  }, [searchParams, defaults]);
  const queryKey = toApiParams(filters, 0).toString();

  const [search, setSearch] = useState(filters.q);
  const [result, setResult] = useState<(ApiResponse & { key: string }) | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [similarOf, setSimilarOf] = useState<{ id: string; name: string } | null>(null);
  const loading = result?.key !== queryKey && error?.key !== queryKey;

  const update = useCallback(
    (next: Filters) => {
      const params = new URLSearchParams();
      for (const key of Object.keys(defaults) as Key[]) if (next[key] !== defaults[key]) params.set(key, next[key]);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, defaults],
  );
  const set = (key: Key, value: string) => update({ ...filters, [key]: value });
  const reset = () => {
    setSearch("");
    update({ ...defaults, sort: filters.sort });
  };

  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => update({ ...filters, q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, filters, update]);

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
    if (!result) return;
    setLoadingMore(true);
    try {
      const data = await fetchJson<ApiResponse>(`/api/channels/breakout?${toApiParams(filters, result.page + 1)}`);
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

  const chips: ActiveChip[] = [];
  const labelOf = (options: Option[], value: string) => options.find((o) => o.value === value)?.label ?? value;
  if (filters.q) chips.push({ key: "q", label: t.common.quoted(filters.q) });
  if (filters.format !== "all") chips.push({ key: "format", label: labelOf(opts.format, filters.format) });
  if (filters.category !== "all") chips.push({ key: "category", label: labelOf(opts.category, filters.category) });
  if (filters.language !== "all") chips.push({ key: "language", label: labelOf(languageOptions, filters.language) });
  if (filters.subs !== "all") chips.push({ key: "subs", label: labelOf(opts.subs, filters.subs) });
  if (filters.age !== "all") chips.push({ key: "age", label: labelOf(ageOptions, filters.age) });
  if (filters.hitRate !== "all") chips.push({ key: "hitRate", label: labelOf(hitRateOptions, filters.hitRate) });
  if (filters.withOutliers === "true") chips.push({ key: "withOutliers", label: tb.withOutliers });

  const items = result?.key === queryKey ? result.items : [];

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{labels.title}</h2>
          <p className="text-sm text-muted-foreground">{labels.description}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tb.searchPlaceholder}
              className="h-10 pl-9"
            />
          </div>
        </div>

        <TopicChips
          topics={config.topics.map((topic) => ({
            label: topicLabels[topic.key],
            active: Object.entries(topic.filters).every(([k, v]) => filters[k as Key] === v),
            onPick: () => update({ ...defaults, sort: filters.sort, ...topic.filters }),
          }))}
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t.explorer.filterBy}</span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[filters.format]}
              onValueChange={(v: string[]) => v[0] && set("format", v[0])}
              className="col-span-2"
            >
              {opts.format.map((o) => (
                <ToggleGroupItem
                  key={o.value}
                  value={o.value}
                  className="px-3 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
                >
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FilterSelect
              value={filters.category}
              options={opts.category}
              onChange={(v) => set("category", v)}
              icon={<LayoutGrid className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.language}
              options={languageOptions}
              onChange={(v) => set("language", v)}
              icon={<Globe className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.subs}
              options={opts.subs}
              onChange={(v) => set("subs", v)}
              icon={<Users className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.age}
              options={ageOptions}
              onChange={(v) => set("age", v)}
              icon={<CalendarClock className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.hitRate}
              options={hitRateOptions}
              onChange={(v) => set("hitRate", v)}
              icon={<Target className="size-3.5 text-muted-foreground" />}
            />
            <Toggle
              variant="outline"
              pressed={filters.withOutliers === "true"}
              onPressedChange={(pressed: boolean) => set("withOutliers", pressed ? "true" : "false")}
              className="px-2.5 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
            >
              {tb.withOutliers}
            </Toggle>
          </div>
        </div>

        <ActiveFilters
          chips={chips}
          onRemove={(key) => {
            if (key === "q") setSearch("");
            set(key as Key, defaults[key as Key]);
          }}
          onClear={reset}
        />

        <ResultsBar
          loading={loading}
          total={result?.key === queryKey ? result.total : 0}
          noun={tb.noun}
          updatedAt={result?.updatedAt ?? null}
          sort={
            <FilterSelect value={filters.sort} options={sortOptions} onChange={(v) => set("sort", v)} className="w-auto" />
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
            <Button variant="outline" size="sm" onClick={reset}>
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
                />
              ))}
            </div>
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

      <SimilarChannelsSheet channel={similarOf} onOpenChange={(open) => !open && setSimilarOf(null)} />
    </div>
  );
}
