"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmptyState,
  FilterSelect,
  ResultsBar,
  SessionExpiredError,
  SessionExpiredState,
  fetchJson,
} from "@/components/explorer/explorer-ui";
import { InfiniteScroll } from "@/components/explorer/infinite-scroll";
import { useI18n } from "@/components/i18n-provider";
import { FormatCard } from "./format-card";
import { FormatVideosSheet } from "./format-videos-sheet";
import type { TitleFormat } from "./types";

interface ApiResponse {
  items: TitleFormat[];
  total: number;
  page: number;
  hasMore: boolean;
  updatedAt: string | null;
  languages: { value: string; count: number }[];
}

// Results are tagged with the query they answer, so "loading" is derived instead of set in effects.
type Result = ApiResponse & { key: string };

const SORTS = ["boost", "popular", "recent"] as const;

/** Trending Formats: recurring title structures ([X] for the variable part) and their boost. */
export function TitleFormatsExplorer() {
  const { t, language } = useI18n();
  const tf = t.titleFormats;
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("boost");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [openFormat, setOpenFormat] = useState<TitleFormat | null>(null);

  const params = (page: number) => {
    const p = new URLSearchParams({ sort, page: String(page) });
    if (q) p.set("q", q);
    if (lang !== "all") p.set("lang", lang);
    return p.toString();
  };
  const queryKey = params(0);
  const loading = result?.key !== queryKey && error?.key !== queryKey;

  // Debounce the search box.
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ApiResponse>(`/api/formats?${queryKey}`)
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
      const data = await fetchJson<ApiResponse>(`/api/formats?${params(result.page + 1)}`);
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
    setLang("all");
  };

  const items = result?.key === queryKey ? result.items : [];
  // Keep the language list from the last answer so the select doesn't empty while loading
  const languages = result?.languages ?? [];

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{tf.title}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{tf.description}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tf.searchPlaceholder}
              className="h-10 pl-9"
            />
          </div>
          <FilterSelect
            value={lang}
            onChange={setLang}
            className="h-10 w-full sm:w-52"
            options={[
              { value: "all", label: tf.allLanguages },
              ...languages
                .filter((l) => l.value !== "unknown")
                .map((l) => ({ value: l.value, label: `${language(l.value)} (${l.count})` })),
            ]}
          />
        </div>

        <ResultsBar
          loading={loading}
          total={result?.key === queryKey ? result.total : 0}
          noun={tf.noun}
          updatedAt={result?.updatedAt ?? null}
          sort={
            <FilterSelect
              value={sort}
              options={SORTS.map((s) => ({ value: s, label: tf.sorts[s] }))}
              onChange={(v) => setSort(v as (typeof SORTS)[number])}
              className="w-auto"
            />
          }
        />

        {error?.key === queryKey ? (
          error.error instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title={tf.loadError} description={t.common.loadErrorHint}>
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
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-xl border p-5">
                <Skeleton className="h-5 w-1/3" />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Skeleton key={j} className="aspect-video w-full" />
                  ))}
                </div>
                <Skeleton className="h-28 w-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={tf.emptyTitle} description={tf.emptyDescription}>
            <Button variant="outline" size="sm" onClick={reset}>
              {t.common.resetFilters}
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {items.map((format) => (
                <FormatCard key={format.id} format={format} onOpenVideos={() => setOpenFormat(format)} />
              ))}
            </div>
            <InfiniteScroll hasMore={!!result?.hasMore} loading={loadingMore} onLoadMore={loadMore} />
            {!result?.hasMore && <p className="text-center text-xs text-muted-foreground">{tf.updatedHint}</p>}
          </>
        )}
      </div>

      <FormatVideosSheet format={openFormat} onOpenChange={(open) => !open && setOpenFormat(null)} />
    </div>
  );
}
