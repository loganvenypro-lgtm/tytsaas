"use client";

import { Eye, Flame, MessageCircle, ThumbsUp, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatCompactNumber } from "@/lib/utils";
import { CATEGORY_LABELS, LANGUAGE_LABELS } from "./filter-options";

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
  channel: {
    id: string;
    name: string;
    handle: string | null;
    avatar: string | null;
    subscribers: number | null;
    country: string | null;
  };
}

function timeAgo(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "il y a moins d'1 h";
  if (hours < 24) return `il y a ${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return `il y a ${Math.round(days / 30)} mois`;
}

function multiplierTone(multiplier: number) {
  if (multiplier >= 10) return "bg-emerald-600 text-white";
  if (multiplier >= 3) return "bg-emerald-500/90 text-white";
  return "bg-white/90 text-slate-900";
}

export function OutlierCard({ video }: { video: OutlierVideo }) {
  const url = `https://www.youtube.com/watch?v=${video.id}`;
  const language = video.language?.split("-")[0].toLowerCase();
  const engagement =
    video.views > 0 && video.likes != null ? ((video.likes + (video.comments ?? 0)) / video.views) * 100 : null;
  const publishedLabel = new Date(video.publishedAt).toLocaleString("fr-FR", {
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
            {video.isShort ? "Short" : "Vidéo longue"}
          </span>
          {video.duration && (
            <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {video.duration}
            </span>
          )}
        </a>
      </div>

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
            · {video.channel.subscribers != null ? `${formatCompactNumber(video.channel.subscribers)} abonnés` : "abonnés masqués"}
          </span>
        </a>

        <div className="grid grid-cols-3 divide-x divide-border/70 rounded-lg bg-muted py-2 text-center">
          <Stat icon={<Eye className="size-3" />} label="Vues" value={formatCompactNumber(video.views)} />
          <Stat
            icon={<Zap className="size-3" />}
            label="Vues/h"
            value={video.viewsPerHour != null ? formatCompactNumber(video.viewsPerHour) : "—"}
          />
          <Stat
            icon={<Flame className="size-3" />}
            label="Normale"
            value={video.usualViews != null ? formatCompactNumber(video.usualViews) : "—"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {video.score != null && (
            <Tooltip>
              <TooltipTrigger render={<Badge>{Math.round(video.score)}/100</Badge>} />
              <TooltipContent>Score de pertinence : multiplicateur, vues, ratio vues/abonnés et fraîcheur</TooltipContent>
            </Tooltip>
          )}
          {video.categoryId != null && CATEGORY_LABELS[video.categoryId] && (
            <Badge variant="secondary">{CATEGORY_LABELS[video.categoryId]}</Badge>
          )}
          {language && <Badge variant="outline">{LANGUAGE_LABELS[language] ?? language.toUpperCase()}</Badge>}
          {video.channel.country && <Badge variant="outline">{video.channel.country}</Badge>}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger render={<span>{timeAgo(video.publishedAt)}</span>} />
            <TooltipContent>Publiée le {publishedLabel}</TooltipContent>
          </Tooltip>
          <span className="flex items-center gap-2.5 tabular-nums">
            {video.likes != null && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="size-3" />
                {formatCompactNumber(video.likes)}
              </span>
            )}
            {video.comments != null && (
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                {formatCompactNumber(video.comments)}
              </span>
            )}
            {engagement != null && <span>{engagement.toFixed(1)} %</span>}
          </span>
        </div>
      </div>
    </Card>
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
