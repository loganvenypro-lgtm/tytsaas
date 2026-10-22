"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, Download, LayoutGrid, Loader2, Plus, Search, Sparkles, Table2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EmptyState,
  FilterSelect,
  SessionExpiredError,
  SessionExpiredState,
  fetchJson,
} from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import {
  FOLLOWED_CHANGED_EVENT,
  importOutlrChannels,
  listUrl,
  markFollowedSeen,
  type FollowKind,
  type InspirationChannel,
  type InspirationsResponse,
} from "@/lib/inspirations";
import { AddChannelDialog } from "./add-channel-dialog";
import { CompetitorComparison } from "./competitor-comparison";
import { InspirationCard } from "./inspiration-card";

type Sort = "lastOutlier" | "outliers" | "best" | "followed" | "name";
const SORTS: Sort[] = ["lastOutlier", "outliers", "best", "followed", "name"];
const MULTIPLIERS = ["2", "3", "5", "10"];
const PERIODS = ["30", "90", "365"] as const;
const FORMATS = ["all", "long", "short"] as const;

const time = (value: string | null) => (value ? new Date(value).getTime() : 0);

const COMPARE: Record<Sort, (a: InspirationChannel, b: InspirationChannel) => number> = {
  lastOutlier: (a, b) => b.newOutliers - a.newOutliers || time(b.lastOutlierAt) - time(a.lastOutlierAt),
  outliers: (a, b) => b.outliers - a.outliers || (b.bestMultiplier ?? 0) - (a.bestMultiplier ?? 0),
  best: (a, b) => (b.bestMultiplier ?? 0) - (a.bestMultiplier ?? 0),
  followed: (a, b) => time(b.followedAt) - time(a.followedAt),
  name: (a, b) => a.name.localeCompare(b.name),
};

/**
 * Inspirations and Competitors: the channels the user follows as this kind,
 * with their latest outliers, the user's tags and notes, and a "new" badge on
 * outliers published since the last visit. Competitors also get a comparison
 * table with the user's channel. Threshold, period and format are read by the
 * backend; tag, search and sort run here on the loaded list.
 */
export function FollowedChannelsExplorer({ kind }: { kind: FollowKind }) {
  const { t } = useI18n();
  const ti = t.inspirations;
  const page = ti.pages[kind];

  const [minMultiplier, setMinMultiplier] = React.useState("3");
  const [period, setPeriod] = React.useState<(typeof PERIODS)[number]>("90");
  const [format, setFormat] = React.useState<(typeof FORMATS)[number]>("all");
  const [sort, setSort] = React.useState<Sort>("lastOutlier");
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const [tag, setTag] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [reloadToken, setReloadToken] = React.useState(0);
  const [importing, setImporting] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  const queryKey = new URLSearchParams({ minMultiplier, period, format }).toString();
  const [result, setResult] = React.useState<(InspirationsResponse & { key: string }) | null>(null);
  const [error, setError] = React.useState<{ key: string; error: Error } | null>(null);
  const loading = result?.key !== queryKey && error?.key !== queryKey;

  // Loaded once per filter change and after a follow / unfollow anywhere on the page
  React.useEffect(() => {
    let cancelled = false;
    fetchJson<InspirationsResponse>(listUrl(kind, queryKey))
      .then((data) => !cancelled && setResult({ ...data, key: queryKey }))
      .catch((err: Error) => !cancelled && setError({ key: queryKey, error: err }));
    return () => {
      cancelled = true;
    };
  }, [kind, queryKey, reloadToken]);

  React.useEffect(() => {
    const reload = () => setReloadToken((n) => n + 1);
    window.addEventListener(FOLLOWED_CHANGED_EVENT, reload);
    return () => window.removeEventListener(FOLLOWED_CHANGED_EVENT, reload);
  }, []);

  // "New" stays visible for this whole visit: outliers count as seen when the user
  // leaves, once the list was shown (not on Strict Mode's test unmount)
  const shown = React.useRef(false);
  React.useEffect(() => {
    if (result) shown.current = true;
  }, [result]);
  React.useEffect(() => {
    const leave = () => shown.current && markFollowedSeen(kind);
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [kind]);

  const channels = React.useMemo(() => result?.channels ?? [], [result]);
  const patchChannel = (id: string, patch: Pick<InspirationChannel, "tags" | "notes">) =>
    setResult((prev) => prev && { ...prev, channels: prev.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const markAllSeen = async () => {
    await markFollowedSeen(kind);
    setResult(
      (prev) =>
        prev && {
          ...prev,
          channels: prev.channels.map((c) => ({ ...c, newOutliers: 0, videos: c.videos.map((v) => ({ ...v, isNew: false })) })),
        },
    );
  };

  const importOutlr = async () => {
    setImporting(true);
    try {
      const imported = await importOutlrChannels(kind);
      toast.add({ type: "success", title: ti.imported(imported) });
    } catch (err) {
      toast.add({ type: "error", title: ti.importError, description: err instanceof Error ? err.message : undefined });
    } finally {
      setImporting(false);
    }
  };

  // Tags with how many channels carry them, most used first
  const tagCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of channels) for (const x of c.tags) counts.set(x, (counts.get(x) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [channels]);
  const allTags = tagCounts.map(([x]) => x);
  const activeTag = tag && tagCounts.some(([x]) => x === tag) ? tag : null;

  const needle = search.trim().toLowerCase();
  const visible = channels
    .filter((c) => !activeTag || c.tags.includes(activeTag))
    .filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        (c.handle ?? "").toLowerCase().includes(needle) ||
        (c.notes ?? "").toLowerCase().includes(needle) ||
        c.tags.some((x) => x.toLowerCase().includes(needle)),
    )
    .sort(COMPARE[sort]);
  const newTotal = channels.reduce((sum, c) => sum + c.newOutliers, 0);
  const withNew = channels.filter((c) => c.newOutliers > 0).length;

  const ready = result?.key === queryKey;
  const importable = result?.importable ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{page.title}</h2>
            <p className="text-sm text-muted-foreground">{page.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ready && importable > 0 && channels.length > 0 && (
              <Button variant="outline" size="sm" onClick={importOutlr} disabled={importing}>
                {importing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {ti.importButton(importable)}
              </Button>
            )}
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/alerts" />}>
              <Bell className="size-4" />
              {ti.alertsLink}
            </Button>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              {ti.add.button[kind]}
            </Button>
          </div>
        </div>

        {ready && newTotal > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 font-medium text-emerald-800 dark:text-emerald-300">
              <Sparkles className="size-4 shrink-0" />
              {ti.newBanner(newTotal, withNew)}
            </span>
            <Button variant="ghost" size="sm" onClick={markAllSeen} className="w-fit">
              <CheckCheck className="size-4" />
              {ti.markSeen}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ti.searchPlaceholder}
              className="h-10 pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <FilterSelect
              value={minMultiplier}
              options={MULTIPLIERS.map((m) => ({ value: m, label: ti.threshold(m) }))}
              onChange={setMinMultiplier}
            />
            <FilterSelect
              value={period}
              options={PERIODS.map((p) => ({ value: p, label: ti.periods[p] }))}
              onChange={(v) => setPeriod(v as (typeof PERIODS)[number])}
            />
            <FilterSelect
              value={format}
              options={FORMATS.map((f) => ({ value: f, label: ti.formats[f] }))}
              onChange={(v) => setFormat(v as (typeof FORMATS)[number])}
            />
            <FilterSelect
              value={sort}
              options={SORTS.map((s) => ({ value: s, label: ti.sorts[s] }))}
              onChange={(v) => setSort(v as Sort)}
            />
            {kind === "competitor" && (
              <ToggleGroup
                variant="outline"
                value={[view]}
                onValueChange={(v: string[]) => v[0] && setView(v[0] as "cards" | "table")}
                className="col-span-2 w-fit"
              >
                <ToggleGroupItem value="cards" aria-label={ti.views.cards} title={ti.views.cards}>
                  <LayoutGrid className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label={ti.views.table} title={ti.views.table}>
                  <Table2 className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
        </div>

        {tagCounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Tag className="size-3.5" />
              {ti.tags}
            </span>
            <Button variant={activeTag ? "secondary" : "default"} size="sm" className="rounded-full" onClick={() => setTag(null)}>
              {ti.allTags(channels.length)}
            </Button>
            {tagCounts.map(([x, count]) => (
              <Button
                key={x}
                variant={activeTag === x ? "default" : "secondary"}
                size="sm"
                className="rounded-full"
                onClick={() => setTag(activeTag === x ? null : x)}
              >
                #{x} <span className="opacity-60">{count}</span>
              </Button>
            ))}
          </div>
        )}

        {ready && channels.length > 0 && (
          <p className="text-sm text-muted-foreground">{ti.count(visible.length, channels.length)}</p>
        )}

        {error?.key === queryKey ? (
          error.error instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title={page.loadError} description={t.common.loadErrorHint}>
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
              <Skeleton key={i} className="h-[420px] rounded-xl" />
            ))}
          </div>
        ) : channels.length === 0 ? (
          <EmptyState title={page.emptyTitle} description={importable > 0 ? page.emptyImportHint(importable) : page.emptyHint}>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                {ti.add.button[kind]}
              </Button>
              {importable > 0 && (
                <Button variant="outline" size="sm" onClick={importOutlr} disabled={importing}>
                  {importing ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {ti.importButton(importable)}
                </Button>
              )}
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/trending/breakout-creators" />}>
                {ti.findChannels}
              </Button>
            </div>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title={ti.noMatch} description={ti.noMatchHint}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTag(null);
                setSearch("");
              }}
            >
              {t.common.resetFilters}
            </Button>
          </EmptyState>
        ) : kind === "competitor" && view === "table" ? (
          <CompetitorComparison me={result?.me ?? null} competitors={visible} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {visible.map((channel) => (
              <InspirationCard
                key={channel.id}
                kind={kind}
                channel={channel}
                allTags={allTags}
                onChange={(patch) => patchChannel(channel.id, patch)}
                onTag={setTag}
              />
            ))}
          </div>
        )}
      </div>

      <AddChannelDialog kind={kind} open={adding} onOpenChange={setAdding} />
    </div>
  );
}
