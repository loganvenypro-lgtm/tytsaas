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
  fetchJson,
} from "@/components/explorer/explorer-ui";
import { useOptionLabels } from "@/components/explorer/filter-spec";
import { InfiniteScroll } from "@/components/explorer/infinite-scroll";
import { useI18n } from "@/components/i18n-provider";
import { TerminatedChannelCard, type TerminatedChannel } from "./terminated-channel-card";

type Sort = "recent" | "subscribers" | "views";

interface ApiResponse {
  items: TerminatedChannel[];
  total: number;
  page: number;
  hasMore: boolean;
}

export function TerminatedExplorer() {
  const { t } = useI18n();
  const tt = t.terminated;
  const labelOf = useOptionLabels("channels");

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [niche, setNiche] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [result, setResult] = useState<(ApiResponse & { key: string }) | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const params = (page: number) => {
    const p = new URLSearchParams({ sort, page: String(page) });
    if (q) p.set("q", q);
    if (niche) p.set("niche", niche);
    return p.toString();
  };
  const queryKey = params(0);
  const loading = result?.key !== queryKey && error?.key !== queryKey;

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ApiResponse>(`/api/channels/terminated?${queryKey}`)
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
      const data = await fetchJson<ApiResponse>(`/api/channels/terminated?${params(result.page + 1)}`);
      setResult((prev) => (prev && prev.key === queryKey ? { ...data, key: queryKey, items: [...prev.items, ...data.items] } : prev));
    } catch (err) {
      setError({ key: queryKey, error: err as Error });
    } finally {
      setLoadingMore(false);
    }
  };

  const reset = () => {
    setSearch("");
    setQ("");
    setNiche(null);
  };
  const chips = [
    ...(q ? [{ key: "q", label: t.common.quoted(q) }] : []),
    ...(niche ? [{ key: "niche", label: labelOf("niche", niche) ?? niche }] : []),
  ];
  const sortOptions = (Object.keys(tt.sorts) as Sort[]).map((value) => ({ value, label: tt.sorts[value] }));
  const items = result?.key === queryKey ? result.items : [];

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{tt.title}</h2>
          <p className="text-sm text-muted-foreground">{tt.description}</p>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tt.searchPlaceholder}
            className="h-10 pl-9"
          />
        </div>

        <ActiveFilters
          chips={chips}
          onRemove={(key) => {
            if (key === "q") {
              setSearch("");
              setQ("");
            } else setNiche(null);
          }}
          onClear={reset}
        />

        <ResultsBar
          loading={loading}
          total={result?.key === queryKey ? result.total : 0}
          noun={tt.noun}
          updatedAt={null}
          sort={<FilterSelect value={sort} options={sortOptions} onChange={(v) => setSort(v as Sort)} className="w-auto" />}
        />

        {error?.key === queryKey ? (
          error.error instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title={tt.loadError} description={t.common.loadErrorHint}>
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
              <Skeleton key={i} className="h-[300px] rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={tt.emptyTitle} description={chips.length ? tt.emptySearchDescription : tt.emptyDescription}>
            {chips.length > 0 && (
              <Button variant="outline" size="sm" onClick={reset}>
                {t.common.resetFilters}
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {items.map((channel) => (
                <TerminatedChannelCard key={channel.id} channel={channel} onFilter={(_, value) => setNiche(value)} />
              ))}
            </div>
            <InfiniteScroll hasMore={!!result?.hasMore} loading={loadingMore} onLoadMore={loadMore} />
          </>
        )}
      </div>
    </div>
  );
}
