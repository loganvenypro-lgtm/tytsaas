"use client";

import { ExternalLink, Flame, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

export interface TrendChannel {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  subscribers: number | null;
  country: string | null;
  categoryId: number | null;
  language: string | null;
  isShortsChannel: boolean;
  trendScore: number | null;
  recentRatio: number | null;
  createdAt: string | null;
  discoveredAt: string | null;
  outlierRate: number | null;
  opportunityScore: number | null;
  views24h: number | null;
  viewsPrev24h: number | null;
  subs24h: number | null;
  views7d: number;
  uploads7d: number;
  outliers30d: number;
  bestMultiplier: number | null;
  videos: {
    id: string;
    title: string;
    thumbnail: string;
    views: number;
    multiplier: number | null;
    publishedAt: string;
    isShort: boolean;
  }[];
}

export function DiscoveredBadge({ at }: { at: string }) {
  const { t, date, ago } = useI18n();
  return (
    <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground" title={date(at, { dateStyle: "medium", timeStyle: "short" })}>
      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      {t.time.discovered(ago(at))}
    </Badge>
  );
}

export function subscribersPerDay(subscribers: number | null, createdAt: string | null): number | null {
  if (subscribers == null || !createdAt) return null;
  const days = Math.max(1, (Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return Math.round(subscribers / days);
}

export function ChannelCard({
  channel,
  rank,
  variant = "trends",
  onSimilar,
}: {
  channel: TrendChannel;
  rank: number;
  variant?: "trends" | "finder";
  onSimilar: () => void;
}) {
  const { t, compact, ago, language: languageName } = useI18n();
  const tc = t.breakout.card;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${compact(Math.abs(n))}`;
  const perDay = subscribersPerDay(channel.subscribers, channel.createdAt);
  const headlineScore = variant === "finder" ? channel.opportunityScore : channel.trendScore;
  const language = channel.language ?? null;
  const hasDaily = channel.views24h != null;
  const dayChange =
    hasDaily && channel.viewsPrev24h != null && channel.viewsPrev24h > 0
      ? ((channel.views24h! - channel.viewsPrev24h) / channel.viewsPrev24h) * 100
      : null;

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-start gap-3">
        <span className="pt-1 text-xl font-semibold text-muted-foreground tabular-nums">#{rank}</span>
        <Avatar className="size-10">
          {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
          <AvatarFallback>{channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <a
            href={`https://www.youtube.com/channel/${channel.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium hover:underline"
          >
            {channel.name}
          </a>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{channel.subscribers != null ? t.common.subscribers(compact(channel.subscribers)) : t.common.hiddenSubscribers}</span>
            {channel.createdAt && <span>· {t.time.created(ago(channel.createdAt, "day"))}</span>}
            {language && <span>· {languageName(language)}</span>}
            {channel.country && <span>· {channel.country}</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{channel.isShortsChannel ? t.common.shorts : t.common.longVideos}</Badge>
            {channel.categoryId != null && t.categories[channel.categoryId] && (
              <Badge variant="secondary">{t.categories[channel.categoryId]}</Badge>
            )}
            {channel.discoveredAt && <DiscoveredBadge at={channel.discoveredAt} />}
          </div>
        </div>
        {headlineScore != null && (
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  className={cn(
                    "flex shrink-0 flex-col items-center rounded-lg px-2.5 py-1.5",
                    headlineScore >= 75
                      ? "bg-emerald-600 text-white"
                      : headlineScore >= 50
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-muted text-foreground",
                  )}
                >
                  <span className="text-lg leading-none font-semibold tabular-nums">{Math.round(headlineScore)}</span>
                  <span className="text-[10px] leading-tight opacity-80">
                    {variant === "finder" ? tc.opportunity : tc.trend}
                  </span>
                </div>
              }
            />
            <TooltipContent className="max-w-64">
              {variant === "finder" ? tc.opportunityHint : tc.trendHint}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {channel.videos.length > 0 && (
        <ScrollArea className="-mx-1 w-[calc(100%+0.5rem)]">
          <div className="flex gap-3 px-1 pb-3">
            {channel.videos.map((video) => (
              <a
                key={video.id}
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-44 shrink-0 flex-col gap-1.5"
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  {video.multiplier != null && video.multiplier >= 1 && (
                    <span
                      className={cn(
                        "absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold",
                        video.multiplier >= 3 ? "bg-emerald-600 text-white" : "bg-black/70 text-white",
                      )}
                    >
                      <Flame className="size-2.5" />
                      {video.multiplier.toFixed(1)}x
                    </span>
                  )}
                </div>
                <span className="line-clamp-1 text-xs font-medium group-hover:underline">{video.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t.common.views(compact(video.views))} · {ago(video.publishedAt, "day")}
                </span>
              </a>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2.5 text-center">
        <Insight
          value={perDay != null ? `+${compact(perDay)}` : "—"}
          label={tc.perDay}
          hint={tc.perDayHint}
        />
        <Insight
          value={channel.outlierRate != null ? t.common.percent(Math.round(channel.outlierRate * 100)) : "—"}
          label={tc.hits}
          hint={tc.hitsHint}
        />
        <Insight
          value={channel.opportunityScore != null ? String(Math.round(channel.opportunityScore)) : "—"}
          label={tc.opportunityShort}
          hint={tc.opportunityShortHint}
        />
      </div>

      <div className="flex items-end justify-between gap-4 border-t pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold text-emerald-600 tabular-nums">
            {hasDaily ? signed(channel.views24h!) : signed(channel.views7d)}
          </span>
          <span className="text-xs text-muted-foreground">
            {hasDaily ? tc.views24h : tc.views7d}
          </span>
          {channel.recentRatio != null && channel.recentRatio >= 1.5 && (
            <Badge className="w-fit gap-1 bg-emerald-600 text-white">
              <Flame className="size-3" />{tc.vsUsual(channel.recentRatio.toFixed(1))}
            </Badge>
          )}
          {dayChange != null && (
            <Badge
              variant="secondary"
              className={cn(
                "w-fit gap-1",
                dayChange >= 0 ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700",
              )}
            >
              {dayChange >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {dayChange >= 0 ? "+" : ""}
              {tc.vsYesterday(dayChange.toFixed(0))}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <Metric value={String(channel.uploads7d)} label={tc.uploads7d} />
          <Metric value={String(channel.outliers30d)} label={tc.outliers30d} />
          <Metric value={channel.subs24h != null ? signed(channel.subs24h) : "—"} label={tc.subs24h} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button variant="outline" className="sm:flex-1" onClick={onSimilar}>
          <Users className="size-4" />
          {tc.similar}
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<a href={`https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="size-4" />
          YouTube
        </Button>
      </div>
    </Card>
  );
}

function Insight({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold tabular-nums">{value}</span>
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</span>
          </div>
        }
      />
      <TooltipContent className="max-w-56">{hint}</TooltipContent>
    </Tooltip>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-base font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  );
}
