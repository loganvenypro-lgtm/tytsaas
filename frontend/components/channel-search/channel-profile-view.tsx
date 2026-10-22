"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, LineChart } from "lucide-react";
import { Area, AreaChart, CartesianGrid, LabelList, ReferenceLine, XAxis, YAxis } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { FollowMenu } from "@/components/inspirations/follow-button";
import { CountryFlag } from "@/components/country-flag";
import { type ChannelProfile, type HistoryPoint, type VideoFormat } from "@/lib/channel-search";
import { cn } from "@/lib/utils";
import { ChannelVideos } from "./channel-videos";
import { SimilarChannels } from "./similar-channels";
import { Hint, Thumb, VideoRanking, useNumbers } from "./profile-ui";
import { VideoDetailDialog } from "./video-detail-dialog";

const DAY = 86_400_000;

function Header({ data }: { data: ChannelProfile }) {
  const { t, locale, date, ago, compact } = useI18n();
  const { full } = useNumbers();
  const th = t.channelSearch.header;
  const { channel, ranks } = data;

  const figure = (label: string, value: number | null, rank: number | null) => (
    <div className="flex flex-col gap-1 sm:items-end">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{full(value)}</span>
      {rank != null && (
        <Tooltip>
          <TooltipTrigger
            render={<span className="w-fit rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">n° {full(rank)}</span>}
          />
          <TooltipContent>{th.rank(full(rank), full(ranks.total))}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  return (
    <section className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-5">
        <Avatar className="size-20 shrink-0 ring-4 ring-background outline outline-border sm:size-24">
          {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
          <AvatarFallback className="text-2xl">{channel.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="truncate">{channel.name}</span>
            <CountryFlag country={channel.country} className="h-6" />
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {channel.handle && <span className="font-medium text-foreground">{channel.handle}</span>}
            {channel.videoCount != null && <span>{t.channelSearch.videos(compact(channel.videoCount))}</span>}
            {channel.niche && <Badge variant="secondary">{channel.niche.label[locale]}</Badge>}
            {channel.terminatedAt && <Badge variant="destructive">{th.terminated}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {channel.createdAt && <span>{th.created(date(channel.createdAt, { month: "long", year: "numeric" }))}</span>}
            {channel.updatedAt && <span>{th.updated(ago(channel.updatedAt))}</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 sm:gap-8">
        {figure(th.subscribers, channel.subscribers, ranks.subscribers)}
        {figure(th.totalViews, channel.totalViews, ranks.totalViews)}
      </div>
    </section>
  );
}

function PeriodStrip({ data }: { data: ChannelProfile }) {
  const { t, compact } = useI18n();
  const { usd, decimal } = useNumbers();
  const tp = t.channelSearch.period;
  const { period, monetization } = data;
  const measured = period.days != null;
  const windowLabel = measured ? tp.window(decimal(Math.min(period.days!, 28))) : tp.notMeasured;
  const subs = period.subscribers;

  const cell = (label: string, value: string, sub: React.ReactNode, hint?: string) => (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className="flex items-center gap-1 text-sm font-medium">
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );

  return (
    <section className="grid grid-cols-1 divide-y rounded-xl border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {cell(tp.views, period.views != null ? `+${compact(period.views)}` : "—", windowLabel, measured ? undefined : tp.notMeasuredHint)}
      {cell(tp.subscribers, subs != null ? `${subs >= 0 ? "+" : ""}${compact(subs)}` : "—", windowLabel)}
      {cell(
        tp.revenue,
        period.revenue ? usd(period.revenue.typical) : "—",
        period.revenue ? (
          <>
            {usd(period.revenue.low)} – {usd(period.revenue.high)}
            {monetization.status !== "eligible" && <> · {tp.notEligible}</>}
          </>
        ) : (
          windowLabel
        ),
        tp.revenueHint(usd(monetization.rpm.typical)),
      )}
    </section>
  );
}

type ChartMetric = "views" | "subscribers";
type ChartRange = "7d" | "28d" | "all";

type Upload = ChannelProfile["uploads"][number];
const RANGE_DAYS: Record<ChartRange, number> = { "7d": 7, "28d": 28, all: 30 };
const MIN_HISTORY_28D = 14;
const YOUTUBE_RED = "#ff0033";

/** Upload icons at the bottom of a day's line: YouTube logo for long videos, a Shorts card for Shorts. */
function UploadMarkers({
  viewBox,
  videos,
  onOpen,
}: {
  viewBox?: { x?: number; y?: number; height?: number };
  videos: Upload[];
  onOpen: (videoId: string) => void;
}) {
  if (viewBox?.x == null || viewBox.y == null || viewBox.height == null) return null;
  const widths = videos.map((v) => (v.isShort ? 12 : 18));
  const gap = 3;
  let left = viewBox.x - (widths.reduce((a, b) => a + b, 0) + gap * (videos.length - 1)) / 2;
  const bottom = viewBox.y + viewBox.height - 3;
  return (
    <g>
      {videos.map((v, i) => {
        const w = widths[i];
        const h = v.isShort ? 16 : 13;
        const x = left;
        left += w + gap;
        const y = bottom - h;
        const cx = x + w / 2;
        const cy = y + h / 2;
        return (
          <g
            key={v.id}
            role="button"
            tabIndex={0}
            aria-label={v.title}
            className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-ring [&:focus-visible>rect]:stroke-2"
            onClick={() => onOpen(v.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(v.id)}
          >
            <title>{v.title}</title>
            <rect x={x} y={y} width={w} height={h} rx={v.isShort ? 4 : 3.5} fill={YOUTUBE_RED} />
            <path d={`M${cx - 2.2} ${cy - 3} L${cx + 3} ${cy} L${cx - 2.2} ${cy + 3} Z`} fill="#fff" />
          </g>
        );
      })}
    </g>
  );
}

function GrowthChart({ history, uploads, onOpen }: { history: HistoryPoint[]; uploads: Upload[]; onOpen: (videoId: string) => void }) {
  const { t, compact, date } = useI18n();
  const { full } = useNumbers();
  const fillId = React.useId();
  const tc = t.channelSearch.chart;
  const [metric, setMetric] = React.useState<ChartMetric>("views");
  const byDay = new Map(history.filter((p) => p.views != null).map((p) => [p.date, p]));
  const today = new Date().toISOString().slice(0, 10);
  const end = Math.max(new Date(today).getTime(), ...[...byDay.keys()].map((d) => new Date(d).getTime()));
  // Days since the first reading: "All" spans them, and a period longer than twice the
  // history would only squeeze the curve into a corner, so it waits for more data.
  const historyDays = history.length ? Math.round((end - new Date(history[0].date).getTime()) / DAY) + 1 : 0;
  const spans: Record<ChartRange, number> = { "7d": 7, "28d": 28, all: Math.min(RANGE_DAYS.all, Math.max(historyDays, 3)) };
  const available = (r: ChartRange) => r !== "28d" || historyDays >= MIN_HISTORY_28D;
  const [chosen, setRange] = React.useState<ChartRange | null>(null);
  const range = chosen ?? (historyDays >= MIN_HISTORY_28D ? "28d" : "all");
  const span = spans[range];

  // Every day of the period, measured or not; uploads are marked on their day.
  const uploadsByDay = Map.groupBy(uploads, (u) => u.publishedAt.slice(0, 10));
  const data = Array.from({ length: span }, (_, i) => {
    const day = new Date(end - (span - 1 - i) * DAY).toISOString().slice(0, 10);
    const p = byDay.get(day);
    return {
      date: day,
      value: p ? (metric === "views" ? p.views : p.subscribersGained) : null,
      counter: p ? (metric === "views" ? p.totalViews : p.subscribers) : null,
      uploads: uploadsByDay.get(day) ?? [],
    };
  });
  const measured = data.filter((p) => p.value != null);
  const total = measured.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const label = metric === "views" ? tc.views : tc.subscribers;
  const short = (d: string) => date(d, { day: "numeric", month: "short" });
  const long = (d: string) => date(d, { weekday: "long", day: "numeric", month: "long" });
  const signed = (n: number) => `${metric === "subscribers" && n > 0 ? "+" : ""}${full(n)}`;
  const config = { value: { label, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <Card className="gap-4 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={metric} onValueChange={(v) => setMetric(v as ChartMetric)}>
          <TabsList>
            <TabsTrigger value="views">{t.channelSearch.period.views}</TabsTrigger>
            <TabsTrigger value="subscribers">{t.channelSearch.period.subscribers}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={range} onValueChange={(v) => setRange(v as ChartRange)}>
          <TabsList>
            {(["7d", "28d", "all"] as const).map((r) =>
              available(r) ? (
                <TabsTrigger key={r} value={r} className="text-xs">
                  {tc.ranges[r]}
                </TabsTrigger>
              ) : (
                <Tooltip key={r}>
                  {/* A disabled button gets no hover: the span carries the tooltip. */}
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <TabsTrigger value={r} disabled className="text-xs">
                      {tc.ranges[r]}
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>{tc.needsHistory(MIN_HISTORY_28D, historyDays)}</TooltipContent>
                </Tooltip>
              ),
            )}
          </TabsList>
        </Tabs>
      </div>

      {measured.length === 0 && !data.some((p) => p.uploads.length) ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
          <LineChart className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">{tc.empty}</p>
          <p className="max-w-sm px-4 text-xs text-muted-foreground">{tc.emptyHint}</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            <span className="text-2xl font-semibold tabular-nums">{measured.length ? signed(total) : "—"}</span>
            <span className="text-xs text-muted-foreground">{measured.length ? tc.periodTotal(measured.length) : tc.emptyHint}</span>
          </div>
          <ChartContainer config={config} className="aspect-auto h-72 w-full">
            <AreaChart data={data} margin={{ left: 4, right: 24, top: 28, bottom: 0 }}>
              {data
                .filter((p) => p.uploads.length)
                .map((p) => (
                  <ReferenceLine
                    key={p.date}
                    x={p.date}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    label={(props: { viewBox?: { x?: number; y?: number; height?: number } }) => (
                      <UploadMarkers viewBox={props.viewBox} videos={p.uploads} onOpen={onOpen} />
                    )}
                  />
                ))}
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} tickFormatter={short} padding={{ left: 16, right: 0 }} />
              <YAxis tickLine={false} axisLine={false} width={52} domain={metric === "views" ? [0, "auto"] : ["auto", "auto"]} tickFormatter={(v: number) => compact(v)} />
              <ChartTooltip
                cursor={{ stroke: "var(--color-value)", strokeDasharray: "4 4" }}
                content={({ active, payload }) => {
                  const p = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                  if (!p) return null;
                  return (
                    <div className="flex min-w-56 max-w-72 flex-col gap-1.5 rounded-lg border bg-background px-2.5 py-2 text-xs shadow-xl">
                      <span className="font-medium">{long(p.date)}</span>
                      {p.value != null ? (
                        <>
                          <span className="flex justify-between gap-4">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold tabular-nums">{signed(p.value)}</span>
                          </span>
                          {p.counter != null && (
                            <span className="flex justify-between gap-4">
                              <span className="text-muted-foreground">
                                {metric === "views" ? t.channelSearch.header.totalViews : t.channelSearch.header.subscribers}
                              </span>
                              <span className="tabular-nums">{full(p.counter)}</span>
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">{tc.notMeasured}</span>
                      )}
                      {p.uploads.map((u) => (
                        <span key={u.id} className="flex items-start gap-1.5 border-t pt-1.5">
                          <span className="mt-0.5 shrink-0 rounded-[3px] bg-[#ff0033] px-1 text-[9px] font-semibold text-white">
                            {u.isShort ? t.common.short : "▶"}
                          </span>
                          <span className="line-clamp-2">{u.title}</span>
                        </span>
                      ))}
                    </div>
                  );
                }}
              />
              <Area
                dataKey="value"
                // YouTube rounds public subscriber counts: gains come in steps, a smoothed curve would invent a dip.
                type={metric === "views" ? "monotone" : "linear"}
                stroke="var(--color-value)"
                strokeWidth={2.5}
                fill={`url(#${fillId})`}
                connectNulls
                dot={{ r: 4, fill: "var(--background)", stroke: "var(--color-value)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "var(--color-value)", stroke: "var(--background)", strokeWidth: 2 }}
              >
                {measured.length <= 14 && (
                  <LabelList
                    dataKey="value"
                    position="top"
                    offset={12}
                    className="fill-foreground text-[11px] font-medium"
                    formatter={(v: unknown) => (v == null ? "" : compact(Number(v)))}
                  />
                )}
              </Area>
            </AreaChart>
          </ChartContainer>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        {metric === "subscribers" && <>{tc.subscribersRounded} </>}
        {tc.retention}
      </p>
    </Card>
  );
}

/** YouTube Studio's comparison: the 10 latest videos of a format by views, the newest highlighted. */
function RankingCard({
  latest,
  format,
  onFormatChange,
  onOpen,
}: {
  latest: ChannelProfile["latest"];
  format: VideoFormat;
  onFormatChange: (format: VideoFormat) => void;
  onOpen: (videoId: string) => void;
}) {
  const { t } = useI18n();
  const tr = t.channelSearch.ranking;
  const videos = latest[format];
  return (
    <Card className="gap-3 px-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{tr.title}</span>
          <span className="text-xs text-muted-foreground">{tr.caption}</span>
        </div>
        {latest.long.length > 0 && latest.short.length > 0 && (
          <Tabs value={format} onValueChange={(v) => onFormatChange(v as VideoFormat)}>
            <TabsList className="h-7">
              <TabsTrigger value="long" className="text-xs">
                {t.common.longVideos}
              </TabsTrigger>
              <TabsTrigger value="short" className="text-xs">
                {t.common.shorts}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>
      {videos.length ? (
        <VideoRanking videos={videos} highlight={videos[0].id} onOpen={(v) => onOpen(v.id)} />
      ) : (
        <p className="px-1 text-sm text-muted-foreground">{tr.empty}</p>
      )}
    </Card>
  );
}

/** Whole-channel views of the last 24 and 48 hours, then the latest videos bringing most of them. */
function RecentViewsCard({ data, onOpen }: { data: ChannelProfile; onOpen: (videoId: string) => void }) {
  const { t, compact } = useI18n();
  const tr = t.channelSearch.recentViews;
  const top = [...data.latest.long, ...data.latest.short]
    .map((v) => ({ video: v, gain: v.views48h ?? v.views24h }))
    .filter((v): v is { video: (typeof v)["video"]; gain: number } => v.gain != null && v.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);
  const figure = (label: string, value: number | null) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{value != null ? `+${compact(value)}` : "—"}</span>
    </div>
  );
  return (
    <Card className="gap-4 px-4 py-4">
      <div className="flex flex-col">
        <span className="flex items-center gap-1 text-sm font-medium">
          {tr.title}
          <Hint text={tr.hint} />
        </span>
        <span className="text-xs text-muted-foreground">{tr.channelWide}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {figure(tr.h24, data.recent.views24h)}
        {figure(tr.h48, data.recent.views48h)}
      </div>
      {top.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{tr.topVideos}</span>
          <ul className="flex flex-col gap-0.5">
            {top.map(({ video, gain }) => (
              <li key={video.id}>
                <button
                  type="button"
                  onClick={() => onOpen(video.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Thumb video={video} label={false} className="w-16" />
                  <span className="min-w-0 flex-1 truncate text-sm">{video.title}</span>
                  <span className="shrink-0 text-right text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{compact(gain)}
                    <span className="block text-[10px] font-normal text-muted-foreground">{video.views48h != null ? "48 h" : "24 h"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SplitCard({ split }: { split: ChannelProfile["split"] }) {
  const { t, compact } = useI18n();
  const ts = t.channelSearch.split;
  const views = split.long.views + split.short.views;
  if (!split.storedVideos) return null;
  const longShare = views ? split.long.views / views : split.long.videos / split.storedVideos;
  const pct = (share: number) => t.common.percent(Math.round(share * 100));
  const sides = [
    { key: "long", label: t.common.longVideos, side: split.long, share: longShare, tone: "bg-chart-1" },
    { key: "short", label: t.common.shorts, side: split.short, share: 1 - longShare, tone: "bg-chart-3" },
  ];
  return (
    <Card className="gap-3 px-4 py-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{ts.title}</span>
        <span className="text-xs text-muted-foreground">{ts.basis(split.storedVideos)}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${t.common.longVideos} ${pct(longShare)}`}>
        {sides.map((s) => s.share > 0 && <div key={s.key} className={s.tone} style={{ width: `${s.share * 100}%` }} />)}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {sides.map((s) => (
          <div key={s.key} className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", s.tone)} />
              {s.label}
            </dt>
            <dd className="text-lg font-semibold tabular-nums">{t.common.views(compact(s.side.views))}</dd>
            <dd className="text-xs text-muted-foreground">
              {ts.videos(s.side.videos)} · {ts.viewsShare(pct(s.share))}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function MonetizationCard({ data }: { data: ChannelProfile["monetization"] }) {
  const { t } = useI18n();
  const { usd } = useNumbers();
  const tm = t.channelSearch.monetization;
  return (
    <Card className="gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{tm.title}</span>
        <Badge variant="secondary" className={cn(data.status === "eligible" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")}>
          {tm.status[data.status ?? "unknown"]}
        </Badge>
      </div>
      {data.monthlyRevenue && (
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{tm.monthly}</span>
          <span className="text-lg font-semibold tabular-nums">
            {usd(data.monthlyRevenue.low)} – {usd(data.monthlyRevenue.high)}
          </span>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">{tm.rpmLong}</dt>
          <dd className="font-semibold tabular-nums">{usd(data.longRpm)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-muted-foreground">{tm.rpmShort}</dt>
          <dd className="font-semibold tabular-nums">{usd(data.shortRpm)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{tm.disclaimer}</p>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-5">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-xl xl:col-span-2" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

const PROFILE_TABS = ["overview", "similar"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

/** The newest format of the channel: what its ranking and video list open on. */
function newestFormat(latest: ChannelProfile["latest"]): VideoFormat {
  const long = latest.long[0]?.publishedAt ?? "";
  const short = latest.short[0]?.publishedAt ?? "";
  return short > long ? "short" : "long";
}

/** /search/channels/[channelId]: one channel's numbers, growth, ranked videos and revenue estimates. */
export function ChannelProfileView({ channelId }: { channelId: string }) {
  const { t } = useI18n();
  const ts = t.channelSearch;
  const [data, setData] = React.useState<ChannelProfile | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [rankingFormat, setRankingFormat] = React.useState<VideoFormat | null>(null);
  const [openVideo, setOpenVideo] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchJson<ChannelProfile>(`/api/channels/${encodeURIComponent(channelId)}/profile`)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((err: Error) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [channelId, reloadToken]);

  const defaultFormat = data ? newestFormat(data.latest) : "long";
  // The tab lives in the URL (?tab=similar) so a tab can be linked to.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: ProfileTab = searchParams.get("tab") === "similar" ? "similar" : "overview";
  const setTab = (next: ProfileTab) =>
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" nativeButton={false} render={<Link href="/search/channels" />}>
          <ArrowLeft className="size-4" />
          {ts.back}
        </Button>
        {data && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<a href={`https://www.youtube.com/channel/${data.channel.id}`} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink className="size-4" />
              {ts.openOnYoutube}
            </Button>
            <FollowMenu channelId={data.channel.id} channelName={data.channel.name} />
          </div>
        )}
      </div>

      {error ? (
        error instanceof SessionExpiredError ? (
          <SessionExpiredState />
        ) : (
          <EmptyState title={ts.notFound} description={error.message || ts.notFoundHint}>
            <Button variant="outline" size="sm" onClick={() => (setError(null), setReloadToken((n) => n + 1))}>
              {t.common.retry}
            </Button>
          </EmptyState>
        )
      ) : !data ? (
        <ProfileSkeleton />
      ) : (
        <>
          <Header data={data} />
          <Tabs value={tab} onValueChange={(v) => setTab(v as ProfileTab)}>
            <TabsList className="h-10 w-full justify-start sm:w-auto">
              {PROFILE_TABS.map((key) => (
                <TabsTrigger key={key} value={key} className="px-4">
                  {ts.tabs[key]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {tab === "similar" ? (
            <SimilarChannels channelId={data.channel.id} onOpenVideo={setOpenVideo} />
          ) : (
            <>
              <PeriodStrip data={data} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <div className="flex flex-col gap-4 xl:col-span-2">
                  <GrowthChart history={data.history} uploads={data.uploads} onOpen={setOpenVideo} />
                  <div className="grid gap-4 md:grid-cols-2">
                    <SplitCard split={data.split} />
                    <MonetizationCard data={data.monetization} />
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <RankingCard
                    latest={data.latest}
                    format={rankingFormat ?? defaultFormat}
                    onFormatChange={setRankingFormat}
                    onOpen={setOpenVideo}
                  />
                  <RecentViewsCard data={data} onOpen={setOpenVideo} />
                </div>
              </div>
              <ChannelVideos
                channelId={data.channel.id}
                counts={{ long: data.split.long.videos, short: data.split.short.videos }}
                defaultFormat={defaultFormat}
                onOpen={setOpenVideo}
              />
            </>
          )}
          <VideoDetailDialog videoId={openVideo} onVideoChange={setOpenVideo} />
        </>
      )}
    </div>
  );
}
