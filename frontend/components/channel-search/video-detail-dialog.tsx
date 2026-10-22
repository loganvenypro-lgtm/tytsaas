"use client";

import * as React from "react";
import { ExternalLink, LineChart } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { MultiplierBadge } from "@/components/my-channel/my-video-row";
import { AbHistory } from "@/components/top-videos/ab-history-sheet";
import type { VideoStats } from "@/lib/channel-search";
import { Hint, Thumb, VideoRanking, useNumbers } from "./profile-ui";

const chartConfig = { views: { color: "var(--chart-1)" } } satisfies ChartConfig;

function ViewsHistory({ history }: { history: VideoStats["history"] }) {
  const { t, compact, date } = useI18n();
  const tv = t.channelSearch.video;
  const fillId = React.useId();
  if (history.length < 2) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center">
        <LineChart className="size-5 text-muted-foreground" />
        <p className="max-w-xs text-xs text-muted-foreground">{tv.historyEmpty}</p>
      </div>
    );
  }
  const data = history.map((h) => ({ at: new Date(h.at).getTime(), views: h.views }));
  const when = (at: number) => date(new Date(at), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <ChartContainer config={{ views: { ...chartConfig.views, label: tv.views } }} className="aspect-auto h-48 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-views)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-views)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="at"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(at: number) => date(new Date(at), { day: "numeric", month: "short" })}
        />
        <YAxis tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} tickFormatter={(v: number) => compact(v)} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => when(Number(payload?.[0]?.payload?.at ?? 0))}
              formatter={(value) => (
                <span className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">{tv.views}</span>
                  <span className="font-medium tabular-nums">{compact(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        <Area dataKey="views" type="monotone" stroke="var(--color-views)" strokeWidth={2} fill={`url(#${fillId})`} />
      </AreaChart>
    </ChartContainer>
  );
}

/**
 * One video's own page in a modal: its numbers, views over time, its rank
 * against the 9 previous videos of its format and its title / thumbnail tests.
 * Clicking a video of the ranking opens that one.
 */
export function VideoDetailDialog({ videoId, onVideoChange }: { videoId: string | null; onVideoChange: (id: string | null) => void }) {
  const { t, compact, date } = useI18n();
  const { usd, full, decimal } = useNumbers();
  const tv = t.channelSearch.video;
  const [result, setResult] = React.useState<{ id: string; data?: VideoStats; error?: string } | null>(null);

  React.useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    fetchJson<VideoStats>(`/api/channels/videos/${encodeURIComponent(videoId)}`)
      .then((data) => !cancelled && setResult({ id: videoId, data }))
      .catch((err: Error) => !cancelled && setResult({ id: videoId, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const current = result?.id === videoId ? result : null;
  const data = current?.data;
  const v = data?.video;
  const hasAbTest = !!v && (v.abTest.thumbnails > 1 || v.abTest.titles > 1);

  const stats: [string, React.ReactNode, React.ReactNode?][] = v
    ? [
        [tv.views, full(v.views)],
        [tv.views24h, v.views24h != null ? `+${compact(v.views24h)}` : "—"],
        [tv.views48h, v.views48h != null ? `+${compact(v.views48h)}` : "—"],
        [tv.perHour, v.viewsPerHour ? compact(v.viewsPerHour) : "—"],
        [tv.likes, v.likes != null ? compact(v.likes) : "—"],
        [tv.comments, v.comments != null ? compact(v.comments) : "—"],
        [tv.engagement, v.engagementRate != null ? t.common.percent(decimal(v.engagementRate * 100)) : "—"],
        [
          tv.multiplier,
          v.multiplier != null && v.multiplier >= 0.1 ? <MultiplierBadge value={v.multiplier} /> : "—",
          v.usualViews != null ? tv.multiplierHint(compact(v.usualViews)) : undefined,
        ],
      ]
    : [];

  return (
    <Dialog open={!!videoId} onOpenChange={(open) => !open && onVideoChange(null)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {current?.error ? (
          <DialogHeader className="p-6">
            <DialogTitle>{tv.loadError}</DialogTitle>
            <DialogDescription>{current.error}</DialogDescription>
          </DialogHeader>
        ) : !v ? (
          <div className="flex flex-col gap-4 p-6">
            <div className="flex gap-4">
              <Skeleton className="aspect-video w-48 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-56 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <DialogHeader className="flex-row items-start gap-4 border-b p-5 pr-12">
              <Thumb video={v} className="hidden w-44 rounded-lg sm:block" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <DialogTitle className="text-lg leading-snug">{v.title}</DialogTitle>
                <DialogDescription>
                  {data.channel?.name} · {tv.published(date(v.publishedAt, { dateStyle: "long" }))}
                </DialogDescription>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" />}
                  >
                    <ExternalLink className="size-4" />
                    {tv.openOnYoutube}
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="flex min-w-0 flex-col gap-6">
                <section className="flex flex-col gap-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                    {stats.map(([label, value, hint]) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                          {label}
                          {hint && <Hint text={String(hint)} />}
                        </dt>
                        <dd className="text-base font-semibold tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      {tv.revenue}
                      <Hint text={tv.revenueHint(usd(v.rpm))} />
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-lg font-semibold tabular-nums">{usd(v.revenue.typical)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {usd(v.revenue.low)} – {usd(v.revenue.high)}
                      </span>
                    </span>
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">{tv.historyTitle}</h3>
                  <ViewsHistory history={data.history} />
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">{tv.abTitle}</h3>
                  {hasAbTest ? <AbHistory videoId={v.id} /> : <p className="text-sm text-muted-foreground">{tv.abNone}</p>}
                </section>
              </div>

              {data.ranking.length > 1 && (
                <section className="flex min-w-0 flex-col gap-2 lg:border-l lg:pl-5">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-medium">{tv.rankingTitle}</h3>
                    <p className="text-xs text-muted-foreground">{t.channelSearch.ranking.captionVideo}</p>
                  </div>
                  <VideoRanking videos={data.ranking} highlight={v.id} onOpen={(peer) => onVideoChange(peer.id)} />
                </section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
