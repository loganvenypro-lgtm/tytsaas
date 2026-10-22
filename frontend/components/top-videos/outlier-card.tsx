"use client";

import { useState } from "react";
import { Eye, Flame, MessageCircle, SplitSquareHorizontal, ThumbsUp, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOptionLabels } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { SaveToFolderMenu } from "@/components/folders/save-to-folder-menu";
import { AbHistorySheet } from "./ab-history-sheet";

export interface OutlierVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number | null;
  comments: number | null;
  duration: string | null;
  isShort: boolean;
  multiplier: number | null;
  usualViews: number | null;
  viewsPerHour: number | null;
  score: number | null;
  categoryId: number | null;
  language: string | null;
  // Classification (lib/taxonomy on the backend); labels come from /api/filters/videos
  niche?: string | null;
  subNiche?: string | null;
  style?: string | null;
  hooks?: string[];
  /** How many thumbnails / titles the scanner has seen on this video. */
  abTest?: { thumbnails: number; titles: number };
  channel: {
    id: string;
    name: string;
    handle: string | null;
    avatar: string | null;
    subscribers: number | null;
    country: string | null;
  };
}


function multiplierTone(multiplier: number) {
  if (multiplier >= 10) return "bg-emerald-600 text-white";
  if (multiplier >= 3) return "bg-emerald-500/90 text-white";
  return "bg-white/90 text-slate-900";
}

export function OutlierCard({
  video,
  onFilter,
}: {
  video: OutlierVideo;
  /** When given, classification badges filter the list on their value. */
  onFilter?: (key: string, value: string) => void;
}) {
  const { t, compact, date, ago, language: languageName } = useI18n();
  const labelOf = useOptionLabels("videos");
  const [abOpen, setAbOpen] = useState(false);
  const url = `https://www.youtube.com/watch?v=${video.id}`;
  const thumbnails = video.abTest?.thumbnails ?? 1;
  const titles = video.abTest?.titles ?? 1;
  const hasAbTest = thumbnails > 1 || titles > 1;
  const category = labelOf("category", video.categoryId) ?? (video.categoryId != null ? t.categories[video.categoryId] : null);
  const language = video.language?.split("-")[0].toLowerCase();
  const engagement =
    video.views > 0 && video.likes != null ? ((video.likes + (video.comments ?? 0)) / video.views) * 100 : null;
  const publishedLabel = date(video.publishedAt, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Card className="group gap-0 overflow-hidden p-0 transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/[0.06]">
      <div className="relative">
        <a href={url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {video.multiplier != null && video.multiplier >= 1 && (
            <span
              className={cn(
                "absolute top-2 left-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold shadow-sm",
                multiplierTone(video.multiplier),
              )}
            >
              <Flame className="size-3" />
              {video.multiplier.toFixed(1)}x
            </span>
          )}
          <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {video.isShort ? t.common.short : t.common.longVideo}
          </span>
          {video.duration && (
            <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {video.duration}
            </span>
          )}
        </a>
        <div className="absolute top-9 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-data-[popup-open]:opacity-100 [@media(hover:none)]:opacity-100">
          <SaveToFolderMenu
            variant="overlay"
            item={{
              type: "video",
              id: video.id,
              snapshot: {
                title: video.title,
                thumbnail: video.thumbnail,
                channelId: video.channel.id,
                channelName: video.channel.name,
                views: video.views,
                multiplier: video.multiplier,
                publishedAt: video.publishedAt,
                isShort: video.isShort,
              },
            }}
          />
        </div>
        {hasAbTest && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setAbOpen(true)}
                  className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-violet-600 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-sm hover:bg-violet-700"
                >
                  <SplitSquareHorizontal className="size-3" />
                  {t.topVideos.ab.badge} · {Math.max(thumbnails, titles)}
                </button>
              }
            />
            <TooltipContent>{t.topVideos.ab.hint(thumbnails, titles)}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {hasAbTest && <AbHistorySheet video={video} open={abOpen} onOpenChange={setAbOpen} />}

      <div className="flex flex-1 flex-col gap-3 p-3.5">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 text-sm leading-snug font-medium text-foreground hover:underline"
          title={video.title}
        >
          {video.title}
        </a>

        <a
          href={`https://www.youtube.com/channel/${video.channel.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-2"
        >
          <Avatar className="size-6">
            {video.channel.avatar && <AvatarImage src={video.channel.avatar} alt="" />}
            <AvatarFallback className="text-[10px]">{video.channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="truncate text-xs font-medium text-foreground">{video.channel.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            · {video.channel.subscribers != null ? t.common.subscribers(compact(video.channel.subscribers)) : t.common.hiddenSubscribers}
          </span>
        </a>

        <div className="grid grid-cols-3 divide-x divide-border/70 rounded-lg bg-muted py-2 text-center">
          <Stat icon={<Eye className="size-3" />} label={t.topVideos.card.views} value={compact(video.views)} />
          <Stat
            icon={<Zap className="size-3" />}
            label={t.topVideos.card.velocity}
            value={video.viewsPerHour != null ? compact(video.viewsPerHour) : "—"}
          />
          <Stat
            icon={<Flame className="size-3" />}
            label={t.topVideos.card.usual}
            value={video.usualViews != null ? compact(video.usualViews) : "—"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {video.score != null && (
            <Tooltip>
              <TooltipTrigger render={<Badge>{Math.round(video.score)}/100</Badge>} />
              <TooltipContent>{t.topVideos.card.scoreHint}</TooltipContent>
            </Tooltip>
          )}
          {video.niche ? (
            <FilterBadge filterKey="niche" value={video.niche} label={labelOf("niche", video.niche)} onFilter={onFilter} variant="secondary" />
          ) : (
            category && <Badge variant="secondary">{category}</Badge>
          )}
          {video.subNiche && (
            <FilterBadge filterKey="subNiche" value={video.subNiche} label={labelOf("subNiche", video.subNiche)} onFilter={onFilter} />
          )}
          {video.style && (
            <FilterBadge filterKey="style" value={video.style} label={labelOf("style", video.style)} onFilter={onFilter} />
          )}
          {language && <Badge variant="outline">{languageName(language)}</Badge>}
          {video.channel.country && <Badge variant="outline">{video.channel.country}</Badge>}
        </div>

        {video.hooks && video.hooks.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {video.hooks.map((hook) => (
              <FilterBadge key={hook} filterKey="hooks" value={hook} label={labelOf("hooks", hook)} onFilter={onFilter} plain />
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger render={<span>{ago(video.publishedAt, "hour")}</span>} />
            <TooltipContent>{t.time.publishedOn(publishedLabel)}</TooltipContent>
          </Tooltip>
          <span className="flex items-center gap-2.5 tabular-nums">
            {video.likes != null && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="size-3" />
                {compact(video.likes)}
              </span>
            )}
            {video.comments != null && (
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                {compact(video.comments)}
              </span>
            )}
            {engagement != null && <span>{t.common.percent(engagement.toFixed(1))}</span>}
          </span>
        </div>
      </div>
    </Card>
  );
}

/** A classification value (niche, style, hook…), clickable to filter on it when the list allows it. */
export function FilterBadge({
  filterKey,
  value,
  label,
  onFilter,
  variant = "outline",
  plain = false,
}: {
  filterKey: string;
  value: string;
  label: string | null;
  onFilter?: (key: string, value: string) => void;
  variant?: "outline" | "secondary";
  plain?: boolean;
}) {
  const { t } = useI18n();
  const text = plain ? `#${label ?? value}` : (label ?? value);
  if (!onFilter) return plain ? <span>{text}</span> : <Badge variant={variant}>{text}</Badge>;
  return (
    <button
      type="button"
      title={t.explorer.filterOn(label ?? value)}
      onClick={() => onFilter(filterKey, value)}
      className={plain ? "hover:text-foreground hover:underline" : "rounded-md"}
    >
      {plain ? text : <Badge variant={variant} className="cursor-pointer hover:border-primary/40">{text}</Badge>}
    </button>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 px-1">
      <div className="flex items-center justify-center gap-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
