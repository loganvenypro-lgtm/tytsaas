"use client";

import * as React from "react";
import { SplitSquareHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilterSelect, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { MultiplierBadge } from "@/components/my-channel/my-video-row";
import type { ChannelVideo, VideoFormat, VideosPage } from "@/lib/channel-search";
import { cn } from "@/lib/utils";
import { Thumb, useNumbers } from "./profile-ui";

type Sort = "recent" | "views" | "multiplier";

function AbBadge({ video }: { video: ChannelVideo }) {
  if (video.abTest.thumbnails <= 1 && video.abTest.titles <= 1) return null;
  return (
    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[11px]">
      <SplitSquareHorizontal className="size-3" />
      A/B
    </Badge>
  );
}

function LongCard({ video, onOpen }: { video: ChannelVideo; onOpen: () => void }) {
  const { t, compact, ago } = useI18n();
  const { usd } = useNumbers();
  return (
    <button type="button" onClick={onOpen} className="group flex flex-col gap-2 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
      <Thumb video={video} className="w-full rounded-lg" />
      <span className="line-clamp-2 text-sm font-medium group-hover:underline">{video.title}</span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{t.common.views(compact(video.views))}</span>
        <span>{ago(video.publishedAt, "hour")}</span>
        <MultiplierBadge value={video.multiplier} />
        <AbBadge video={video} />
      </span>
      <span className="flex items-center gap-3 text-xs tabular-nums">
        {video.views24h != null && <span className="text-emerald-600 dark:text-emerald-400">+{compact(video.views24h)} / 24 h</span>}
        <span className="text-muted-foreground">≈ {usd(video.revenue.typical)}</span>
      </span>
    </button>
  );
}

function ShortTile({ video, onOpen }: { video: ChannelVideo; onOpen: () => void }) {
  const { compact } = useI18n();
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[9/16] overflow-hidden rounded-lg bg-muted text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={video.thumbnail} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.03]" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 pt-10 text-white">
        <span className="line-clamp-2 text-xs font-medium">{video.title}</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold tabular-nums">
          {compact(video.views)}
          {video.multiplier != null && video.multiplier >= 2 && (
            <span className="rounded bg-emerald-500/90 px-1 text-[10px]">{video.multiplier.toFixed(1)}x</span>
          )}
        </span>
      </div>
    </button>
  );
}

/** Every video of the channel in the database, long-form or Shorts, newest / most viewed first. */
export function ChannelVideos({
  channelId,
  counts,
  defaultFormat,
  onOpen,
}: {
  channelId: string;
  counts: Record<VideoFormat, number>;
  defaultFormat: VideoFormat;
  onOpen: (videoId: string) => void;
}) {
  const { t } = useI18n();
  const tv = t.channelSearch.allVideos;
  const [format, setFormat] = React.useState<VideoFormat>(defaultFormat);
  const [sort, setSort] = React.useState<Sort>("recent");
  const key = `${channelId}|${format}|${sort}`;
  const [result, setResult] = React.useState<{ key: string; data: VideosPage } | null>(null);
  const [error, setError] = React.useState<{ key: string; message: string } | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const url = (page: number) => `/api/channels/${encodeURIComponent(channelId)}/videos?format=${format}&sort=${sort}&page=${page}`;

  React.useEffect(() => {
    let cancelled = false;
    fetchJson<VideosPage>(url(0))
      .then((data) => !cancelled && setResult({ key, data }))
      .catch((err: Error) => !cancelled && setError({ key, message: err.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loadMore = async () => {
    if (!result || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchJson<VideosPage>(url(result.data.page + 1));
      setResult((prev) => (prev?.key === key ? { key, data: { ...data, items: [...prev.data.items, ...data.items] } } : prev));
    } catch (err) {
      setError({ key, message: (err as Error).message });
    } finally {
      setLoadingMore(false);
    }
  };

  const data = result?.key === key ? result.data : null;
  const failed = error?.key === key ? error.message : null;
  const grid = format === "short" ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{tv.title}</h2>
          <p className="text-sm text-muted-foreground">{tv.count(counts[format])}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
            <TabsList>
              <TabsTrigger value="long">
                {t.common.longVideos} <span className="text-muted-foreground tabular-nums">{counts.long}</span>
              </TabsTrigger>
              <TabsTrigger value="short">
                {t.common.shorts} <span className="text-muted-foreground tabular-nums">{counts.short}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <FilterSelect
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={(["recent", "views", "multiplier"] as const).map((s) => ({ value: s, label: tv.sorts[s] }))}
            className="w-auto"
          />
        </div>
      </div>

      {failed ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{tv.loadError}</p>
      ) : !data ? (
        <div className={cn("grid gap-4", grid)}>
          {Array.from({ length: format === "short" ? 12 : 8 }, (_, i) => (
            <Skeleton key={i} className={cn("rounded-lg", format === "short" ? "aspect-[9/16]" : "aspect-[4/3]")} />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{tv.empty}</p>
      ) : (
        <>
          <div className={cn("grid gap-x-4 gap-y-6", grid)}>
            {data.items.map((v) =>
              format === "short" ? (
                <ShortTile key={v.id} video={v} onOpen={() => onOpen(v.id)} />
              ) : (
                <LongCard key={v.id} video={v} onOpen={() => onOpen(v.id)} />
              ),
            )}
          </div>
          {data.hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t.common.loading : tv.loadMore}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
