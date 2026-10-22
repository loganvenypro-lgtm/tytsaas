"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/i18n-provider";
import type { ChannelVideo, RankedVideo } from "@/lib/channel-search";
import { INTL_LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Full numbers ("523 000 000"), USD amounts and decimals in the interface language. */
export function useNumbers() {
  const { locale } = useI18n();
  return React.useMemo(() => {
    const tag = INTL_LOCALES[locale];
    const full = new Intl.NumberFormat(tag);
    const usdCompact = new Intl.NumberFormat(tag, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
    const usdSmall = new Intl.NumberFormat(tag, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
    const decimal = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
    return {
      full: (n: number | null) => (n == null ? "—" : full.format(n)),
      usd: (n: number | null) => (n == null ? "—" : n < 100 ? usdSmall.format(n) : usdCompact.format(n)),
      decimal: (n: number) => decimal.format(n),
    };
  }, [locale]);
}

export function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Info className="size-3 cursor-help text-muted-foreground" aria-label={text} />} />
      <TooltipContent className="max-w-72">{text}</TooltipContent>
    </Tooltip>
  );
}

/** A video thumbnail with its duration, "Short" or "Live" in the corner. */
export function Thumb({ video, className, label = true }: { video: ChannelVideo; className?: string; label?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={cn("relative aspect-video shrink-0 overflow-hidden rounded-md bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover" />
      {label && (
        <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-medium text-white">
          {video.isLivestream ? t.channelSearch.allVideos.live : video.isShort ? t.common.short : video.duration}
        </span>
      )}
    </div>
  );
}

/**
 * Videos ranked by views like YouTube Studio's comparison: rank, thumbnail, title,
 * views, the `highlight` video on a tinted row. Rows open the video.
 */
export function VideoRanking({
  videos,
  highlight,
  onOpen,
}: {
  videos: RankedVideo[];
  highlight?: string;
  onOpen?: (video: RankedVideo) => void;
}) {
  const { compact } = useI18n();
  const ordered = [...videos].sort((a, b) => a.rank - b.rank);
  return (
    <ol className="flex flex-col gap-0.5">
      {ordered.map((v) => {
        const current = v.id === highlight;
        return (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onOpen?.(v)}
              aria-current={current || undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                current && "bg-blue-500/10 hover:bg-blue-500/15",
              )}
            >
              <span
                className={cn(
                  "w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground",
                  current && "font-semibold text-blue-600 dark:text-blue-400",
                )}
              >
                {v.rank}
              </span>
              <Thumb video={v} label={false} className="w-20" />
              <span className="min-w-0 flex-1 truncate text-sm">{v.title}</span>
              <span className="shrink-0 text-sm font-medium tabular-nums">{compact(v.views)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
