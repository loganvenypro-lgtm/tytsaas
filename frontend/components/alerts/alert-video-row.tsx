"use client";

import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/i18n-provider";
import type { OutlierVideo } from "@/components/top-videos/outlier-card";
import { cn } from "@/lib/utils";

/**
 * A matched video, as a compact row: thumbnail, channel, views and a views-per-hour
 * gauge (full at `vphScale`, the fastest video of the list).
 */
export function AlertVideoRow({
  video,
  vphScale,
  alertName,
  unread = false,
}: {
  video: OutlierVideo;
  vphScale: number;
  alertName?: string;
  unread?: boolean;
}) {
  const { t, compact, ago } = useI18n();
  const ta = t.alerts;
  const vph = video.viewsPerHour ?? 0;
  const ratio = vphScale > 0 ? Math.min(1, vph / vphScale) : 0;
  const circumference = 2 * Math.PI * 20;

  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60",
        unread && "bg-primary/5",
      )}
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-muted sm:w-40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
        {video.isShort && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">{t.common.short}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 text-sm font-medium group-hover:underline">
          {unread && <span className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle" aria-label={ta.unread} />}
          {video.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {video.channel.name}
          {video.channel.subscribers != null && ` · ${t.common.subscribers(compact(video.channel.subscribers))}`} · {ago(video.publishedAt)}
        </span>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{t.common.views(compact(video.views))}</span>
          {video.multiplier != null && (
            <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[11px]">
              <Flame className="size-3" />
              {video.multiplier.toFixed(1)}x
            </Badge>
          )}
          {alertName && (
            <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal">
              {alertName}
            </Badge>
          )}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="relative flex size-14 shrink-0 items-center justify-center">
              <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" className="stroke-muted" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${ratio * circumference} ${circumference}`}
                  className="stroke-orange-500"
                />
              </svg>
              <div className="flex flex-col items-center leading-none">
                <span className="text-xs font-semibold tabular-nums">{video.viewsPerHour != null ? compact(vph) : "—"}</span>
                <span className="text-[9px] text-muted-foreground">{ta.vphShort}</span>
              </div>
            </div>
          }
        />
        <TooltipContent>{ta.vphHint}</TooltipContent>
      </Tooltip>
    </a>
  );
}
