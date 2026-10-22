"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crown, Search, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, FilterSelect, ResultsBar, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { InfiniteScroll } from "@/components/explorer/infinite-scroll";
import { useI18n } from "@/components/i18n-provider";
import { FollowMenu } from "@/components/inspirations/follow-button";
import { OutlierCard, type OutlierVideo } from "@/components/top-videos/outlier-card";
import { cn } from "@/lib/utils";

interface KeywordStats {
  videos: number;
  channels: number;
  totalViews: number;
  avgViews: number | null;
  medianViews: number | null;
  outliers: number;
  last30Days: number;
}

interface KeywordChannel {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  subscribers: number | null;
  videos: number;
  totalViews: number;
  avgViews: number;
  share: number;
  bestMultiplier: number | null;
}

interface ApiResponse {
  items: OutlierVideo[];
  total: number;
  page: number;
  hasMore: boolean;
  stats?: KeywordStats;
  channels?: KeywordChannel[];
  related?: { term: string; count: number }[];
}

// The first page carries the topic overview; later pages only add videos.
type Result = ApiResponse & { key: string };

const DEFAULTS = { format: "all", period: "365d", sort: "multiplier" };
type Param = keyof typeof DEFAULTS | "q";

/** Keywords: a niche seen through one keyword, searched in every analysed title. */
export function KeywordsExplorer() {
  const { t } = useI18n();
  const tk = t.keywords;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = (key: Param) => searchParams.get(key) ?? (key === "q" ? "" : DEFAULTS[key]);
  const q = value("q");

  const [search, setSearch] = useState(q);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const apiParams = (page: number) => {
    const params = new URLSearchParams({ q, format: value("format"), period: value("period"), sort: value("sort") });
    if (page > 0) params.set("page", String(page));
    return params;
  };
  const queryKey = q ? apiParams(0).toString() : "";
  const loading = !!q && result?.key !== queryKey && error?.key !== queryKey;
  // The overview stays on screen while only the sort changes.
  const [overview, setOverview] = useState<{ key: string; data: ApiResponse } | null>(null);
  const overviewKey = q ? `${q}|${value("format")}|${value("period")}` : "";

  const setParams = (changes: Partial<Record<Param, string>>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, v] of Object.entries(changes)) {
      if (!v || v === DEFAULTS[key as keyof typeof DEFAULTS]) next.delete(key);
      else next.set(key, v);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const pick = (keyword: string) => {
    setSearch(keyword);
    setParams({ q: keyword });
  };

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = setTimeout(() => setParams({ q: search.trim() }), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  useEffect(() => {
    if (!queryKey) return;
    let cancelled = false;
    fetchJson<ApiResponse>(`/api/keywords?${queryKey}`)
      .then((data) => {
        if (cancelled) return;
        setResult({ ...data, key: queryKey });
        setOverview({ key: overviewKey, data });
      })
      .catch((err: Error) => !cancelled && setError({ key: queryKey, error: err }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, reloadToken]);

  const loadMore = async () => {
    if (!result || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchJson<ApiResponse>(`/api/keywords?${apiParams(result.page + 1)}`);
      setResult((prev) => (prev && prev.key === queryKey ? { ...prev, ...data, key: queryKey, items: [...prev.items, ...data.items] } : prev));
    } catch (err) {
      setError({ key: queryKey, error: err as Error });
    } finally {
      setLoadingMore(false);
    }
  };

  const items = result?.key === queryKey ? result.items : [];
  const topic = overview?.key === overviewKey ? overview.data : null;
  const failed = error?.key === queryKey ? error.error : null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{tk.title}</h2>
          <p className="text-sm text-muted-foreground">{tk.description}</p>
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setParams({ q: search.trim() });
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tk.searchPlaceholder}
              className="h-10 pl-9"
              maxLength={80}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <FilterSelect
              value={value("format")}
              onChange={(v) => setParams({ format: v })}
              options={[
                { value: "all", label: tk.formats.all },
                { value: "long", label: tk.formats.long },
                { value: "short", label: tk.formats.short },
              ]}
              className="h-10 flex-1 sm:w-auto"
            />
            <FilterSelect
              value={value("period")}
              onChange={(v) => setParams({ period: v })}
              options={(["30d", "90d", "365d", "all"] as const).map((p) => ({ value: p, label: tk.periods[p] }))}
              className="h-10 flex-1 sm:w-auto"
            />
          </div>
        </form>
        <p className="-mt-3 text-xs text-muted-foreground">{tk.searchHint}</p>

        {!q ? (
          <div className="flex flex-col gap-4">
            <KeywordChips label={t.explorer.try} terms={tk.examples} onPick={pick} />
            <EmptyState title={tk.startTitle} description={tk.startDescription} />
          </div>
        ) : failed ? (
          failed instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title={tk.loadError} description={t.common.loadErrorHint}>
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
        ) : !topic && loading ? (
          <OverviewSkeleton />
        ) : topic?.stats && topic.stats.videos === 0 ? (
          <EmptyState title={tk.emptyTitle(q)} description={tk.emptyDescription} />
        ) : (
          <>
            {topic?.stats && <StatTiles stats={topic.stats} />}
            {topic?.related && topic.related.length > 0 && (
              <KeywordChips label={tk.related} terms={topic.related.map((r) => r.term)} onPick={pick} />
            )}
            {topic?.channels && topic.channels.length > 0 && <TopChannels channels={topic.channels} />}

            <ResultsBar
              loading={loading}
              total={result?.key === queryKey ? result.total : 0}
              noun={tk.noun}
              updatedAt={null}
              sort={
                <FilterSelect
                  value={value("sort")}
                  onChange={(v) => setParams({ sort: v })}
                  options={(["multiplier", "views", "recent"] as const).map((s) => ({ value: s, label: tk.sorts[s] }))}
                  className="w-auto"
                />
              }
            />
            {loading ? (
              <VideoGrid>
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
                ))}
              </VideoGrid>
            ) : items.length === 0 ? (
              <EmptyState title={tk.noOutliers} description={tk.noOutliersHint} />
            ) : (
              <>
                <VideoGrid>
                  {items.map((video) => (
                    <OutlierCard key={video.id} video={video} />
                  ))}
                </VideoGrid>
                <InfiniteScroll hasMore={!!result?.hasMore} loading={loadingMore} onLoadMore={loadMore} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatTiles({ stats }: { stats: KeywordStats }) {
  const { t, compact } = useI18n();
  const tk = t.keywords.stats;
  const outlierRate = stats.videos > 0 ? Math.round((stats.outliers / stats.videos) * 100) : 0;
  const tiles = [
    { label: tk.videos, value: compact(stats.videos), hint: tk.recent(compact(stats.last30Days)) },
    { label: tk.avgViews, value: compact(stats.avgViews), hint: tk.median(compact(stats.medianViews)), accent: true },
    { label: tk.channels, value: compact(stats.channels), hint: tk.totalViews(compact(stats.totalViews)) },
    { label: tk.outliers, value: compact(stats.outliers), hint: tk.outlierRate(outlierRate) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn("min-w-0 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3", tile.accent ? "bg-red-600/10 ring-1 ring-red-600/20" : "bg-muted/60")}
        >
          <div className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{tile.label}</div>
          <div className={cn("mt-0.5 truncate text-xl font-semibold tabular-nums sm:text-2xl", tile.accent && "text-red-600 dark:text-red-500")}>
            {tile.value}
          </div>
          <div className="truncate text-xs text-muted-foreground">{tile.hint}</div>
        </div>
      ))}
    </div>
  );
}

function KeywordChips({ label, terms, onPick }: { label: string; terms: string[]; onPick: (term: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {terms.map((term) => (
        <Button key={term} variant="secondary" size="sm" className="rounded-full" onClick={() => onPick(term)}>
          {term}
        </Button>
      ))}
    </div>
  );
}

/** The channels holding the most views on the keyword, with their share of the topic. */
function TopChannels({ channels }: { channels: KeywordChannel[] }) {
  const { t, compact } = useI18n();
  const tk = t.keywords;
  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Crown className="size-4 text-amber-500" />
        <h3 className="text-sm font-semibold">{tk.topChannels}</h3>
        <span className="text-xs text-muted-foreground">{tk.topChannelsHint}</span>
      </div>
      <ol className="divide-y">
        {channels.map((c, i) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{i + 1}</span>
            <a
              href={`https://www.youtube.com/channel/${c.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <Avatar className="size-9 shrink-0">
                <AvatarImage src={c.avatar ?? undefined} alt="" />
                <AvatarFallback>{c.name.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium hover:underline">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[c.subscribers != null ? t.common.subscribers(compact(c.subscribers)) : t.common.hiddenSubscribers, tk.channelVideos(c.videos)].join(" · ")}
                </div>
              </div>
            </a>
            <div className="hidden w-40 shrink-0 flex-col gap-1 md:flex">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{tk.share}</span>
                <span className="font-medium tabular-nums">{t.common.percent(Math.round(c.share * 100))}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(2, Math.round(c.share * 100))}%` }} />
              </div>
            </div>
            <div className="w-20 shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums">{compact(c.totalViews)}</div>
              <div className="text-[11px] text-muted-foreground">{tk.views}</div>
            </div>
            <div className="hidden w-16 shrink-0 text-right sm:block">
              {c.bestMultiplier != null && c.bestMultiplier >= 2 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Sparkles className="size-3" />
                  {c.bestMultiplier}x
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            <div className="hidden shrink-0 lg:block">
              <FollowMenu channelId={c.id} channelName={c.name} />
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function VideoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}
