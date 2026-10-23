"use client";

import { useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, Lightbulb, MessageCircle, SplitSquareHorizontal, ThumbsUp } from "lucide-react";
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


/** The multiplier is the card's headline: red once a video does 10x its channel, muted under 3x. */
function multiplierTone(multiplier: number) {
  if (multiplier >= 10) return "text-brand-text";
  if (multiplier >= 3) return "text-foreground";
  return "text-muted-foreground";
}

const formatMultiplier = (multiplier: number) =>
  multiplier >= 100 ? Math.round(multiplier).toString() : multiplier.toFixed(1);

/** The "Similar videos" page for a video, compared by topic or thumbnail. */
export const similarVideosUrl = (videoId: string, by: "topic" | "thumbnail") =>
  `/search/similar-videos?video=${encodeURIComponent(videoId)}&by=${by}`;

export function OutlierCard({
  video,
  onFilter,
  similarity,
}: {
  video: OutlierVideo;
  /** When given, classification badges filter the list on their value. */
  onFilter?: (key: string, value: string) => void;
  /** Cosine similarity to the video a "Similar videos" search started from (0-1). */
  similarity?: number;
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
    <Card className="group gap-0 overflow-hidden p-0 transition-shadow duration-200 hover:ring-foreground/20">
      <div className="group/thumb relative">
        <a href={url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
          {/* Long-form is the default everywhere: only Shorts are worth flagging */}
          {video.isShort && (
            <span className="absolute top-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {t.common.short}
            </span>
          )}
          {video.duration && (
            <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {video.duration}
            </span>
          )}
        </a>
        {/* "More like this": the overlay lets clicks through to the video, only its buttons catch them */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover/thumb:opacity-100 has-focus-visible:opacity-100">
          <span className="text-xs font-semibold text-white drop-shadow">{t.topVideos.card.moreLikeThis}</span>
          <div className="pointer-events-auto flex gap-1.5">
            <Link
              href={similarVideosUrl(video.id, "topic")}
              className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-900 shadow-sm hover:bg-white/90"
            >
              <Lightbulb className="size-3.5" />
              {t.topVideos.card.moreTopic}
            </Link>
            <Link
              href={similarVideosUrl(video.id, "thumbnail")}
              className="flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-brand-strong"
            >
              <ImageIcon className="size-3.5" />
              {t.topVideos.card.moreThumbnail}
            </Link>
          </div>
        </div>
        {similarity != null && (
          <span
            className={cn(
              "pointer-events-none absolute left-2 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white shadow-sm transition-opacity group-hover/thumb:opacity-0",
              video.isShort ? "top-9" : "top-2",
            )}
          >
            {t.topVideos.card.similarity(Math.round(similarity * 100))}
          </span>
        )}
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 has-data-[popup-open]:opacity-100 [@media(hover:none)]:opacity-100">
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

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 text-[15px] leading-snug font-medium text-pretty text-foreground hover:underline"
            title={video.title}
          >
            {video.title}
          </a>
          <a
            href={`https://www.youtube.com/channel/${video.channel.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-2 text-xs"
          >
            <Avatar className="size-5">
              {video.channel.avatar && <AvatarImage src={video.channel.avatar} alt="" />}
              <AvatarFallback className="text-[9px]">{video.channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-foreground/90 hover:underline">{video.channel.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {video.channel.subscribers != null ? t.common.subscribers(compact(video.channel.subscribers)) : t.common.hiddenSubscribers}
            </span>
          </a>
        </div>

        {/* The outlier itself: how far above the channel's usual views this video went */}
        <div className="flex items-end justify-between gap-3 border-y py-3">
          {video.multiplier != null && video.multiplier >= 1 ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="min-w-0 cursor-default">
                    <div className={cn("text-[28px] leading-none font-semibold tracking-tight tabular-nums", multiplierTone(video.multiplier))}>
                      {formatMultiplier(video.multiplier)}
                      <span className="ml-0.5 text-lg font-medium">×</span>
                    </div>
                    {video.usualViews != null && (
                      <div className="mt-1.5 truncate text-xs text-muted-foreground">
                        {t.topVideos.card.vsUsual(compact(video.usualViews))}
                      </div>
                    )}
                  </div>
                }
              />
              <TooltipContent>{t.topVideos.card.multiplierHint}</TooltipContent>
            </Tooltip>
          ) : (
            <div />
          )}
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold text-foreground tabular-nums">{t.topVideos.card.viewsCount(compact(video.views))}</div>
            {video.viewsPerHour != null && video.viewsPerHour > 0 && (
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">{t.topVideos.card.perHour(compact(video.viewsPerHour))}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger render={<span>{ago(video.publishedAt, "hour")}</span>} />
              <TooltipContent>{t.time.publishedOn(publishedLabel)}</TooltipContent>
            </Tooltip>
            {video.score != null && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="rounded-md border px-1.5 py-px font-medium text-foreground/80 tabular-nums">
                      {Math.round(video.score)}/100
                    </span>
                  }
                />
                <TooltipContent>{t.topVideos.card.scoreHint}</TooltipContent>
              </Tooltip>
            )}
          </span>
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
            {engagement != null && (
              <Tooltip>
                <TooltipTrigger render={<span>{t.common.percent(engagement.toFixed(1))}</span>} />
                <TooltipContent>{t.topVideos.card.engagementHint}</TooltipContent>
              </Tooltip>
            )}
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
