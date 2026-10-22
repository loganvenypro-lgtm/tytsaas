"use client";

import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import type { MyVideo } from "@/lib/my-channel";
import { cn } from "@/lib/utils";

/** A multiplier badge: green from 2x (an outlier), muted under 1x. */
export function MultiplierBadge({ value }: { value: number | null }) {
  // 0 until the worker has measured a brand new video against the channel
  if (value == null || value < 0.1) return null;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 gap-0.5 px-1.5 text-[11px] tabular-nums",
        value >= 2 && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        value < 1 && "text-muted-foreground",
      )}
    >
      {value >= 2 && <Flame className="size-3" />}
      {value.toFixed(1)}x
    </Badge>
  );
}

/** One of the user's videos as a compact row linking to YouTube; `aside` sits on the right. */
export function MyVideoRow({ video, aside, className }: { video: MyVideo; aside?: React.ReactNode; className?: string }) {
  const { t, compact, ago } = useI18n();
  return (
    <div className={cn("flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60", className)}>
      <a
        href={`https://www.youtube.com/watch?v=${video.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted sm:w-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
            {video.isShort ? t.common.short : video.duration}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="line-clamp-2 text-sm font-medium group-hover:underline">{video.title}</span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{t.common.views(compact(video.views))}</span>
            <span>·</span>
            <span>{ago(video.publishedAt, "day")}</span>
            <MultiplierBadge value={video.multiplier} />
          </div>
        </div>
      </a>
      {aside}
    </div>
  );
}
