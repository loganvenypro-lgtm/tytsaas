"use client";

import * as React from "react";
import { Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, FilterSelect, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import type { MyVideo, RevivalVideo, RevivalsResponse } from "@/lib/my-channel";
import { cn } from "@/lib/utils";
import { MyVideoRow } from "./my-video-row";
import { ReportDialog } from "./report-dialog";

const MIN_AGES = ["30", "90", "365"] as const;

/** hot: as many views a day as its lifetime average or more; steady: a real share of it; slow: the usual decay. */
function paceStatus(pace: number | null) {
  if (pace == null) return "slow" as const;
  return pace >= 1 ? ("hot" as const) : pace >= 0.3 ? ("steady" as const) : ("slow" as const);
}

const STATUS_CLASSES = {
  hot: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  steady: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  slow: "bg-muted text-muted-foreground",
};

function RevivalAside({ video, scale, onReport }: { video: RevivalVideo; scale: number; onReport: () => void }) {
  const { t, compact } = useI18n();
  const tr = t.myChannel.revivals;
  const status = paceStatus(video.pace);
  return (
    <div className="flex shrink-0 items-center gap-3 sm:gap-5">
      <div className="hidden w-44 flex-col gap-1 md:flex">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">+{compact(video.views48h)}</span>
          <span className="text-[10px] whitespace-nowrap text-muted-foreground">{tr.window(video.windowHours)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(2, (video.views48h / scale) * 100)}%` }} />
        </div>
      </div>
      <span className="text-sm font-semibold tabular-nums md:hidden">+{compact(video.views48h)}</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge variant="secondary" className={cn("hidden h-6 cursor-help gap-1 px-2 sm:inline-flex", STATUS_CLASSES[status])}>
              {tr.status[status]}
              {video.pace != null && <span className="tabular-nums opacity-80">{video.pace.toFixed(2)}x</span>}
            </Badge>
          }
        />
        <TooltipContent className="max-w-64">
          {video.pace != null && <div className="font-medium">{tr.paceValue(`${video.pace.toFixed(2)}x`)}</div>}
          {tr.paceHint}
        </TooltipContent>
      </Tooltip>
      <Button size="sm" variant="outline" onClick={onReport}>
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">{tr.report}</span>
      </Button>
    </div>
  );
}

/**
 * /my-channel/revivals: the user's older videos ranked by views gained over the
 * last ~48 h (worker snapshots), with an AI report to push each one again.
 */
export function RevivalsView({ reloadToken }: { reloadToken: number }) {
  const { t, compact } = useI18n();
  const tr = t.myChannel.revivals;
  const [minAge, setMinAge] = React.useState<(typeof MIN_AGES)[number]>("30");
  const [result, setResult] = React.useState<(RevivalsResponse & { key: string }) | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [reportVideo, setReportVideo] = React.useState<MyVideo | null>(null);
  const key = `${minAge}:${reloadToken}`;

  React.useEffect(() => {
    let cancelled = false;
    fetchJson<RevivalsResponse>(`/api/my-channel/revivals?minAge=${minAge}`)
      .then((d) => !cancelled && (setResult({ ...d, key }), setError(null)))
      .catch((err: Error) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [minAge, key]);

  const data = result?.key === key ? result : null;
  const scale = Math.max(1, ...(data?.videos ?? []).map((v) => v.views48h));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          {data && data.videos.length > 0 && (
            <span className="text-sm font-medium">{tr.summary(data.videos.length, compact(data.totalViews48h))}</span>
          )}
          {data && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {tr.measured(data.measuredVideos, data.oldVideos)}
              <Tooltip>
                <TooltipTrigger render={<Info className="size-3 cursor-help" aria-label={tr.measuredHint} />} />
                <TooltipContent className="max-w-64">{tr.measuredHint}</TooltipContent>
              </Tooltip>
            </span>
          )}
        </div>
        <FilterSelect
          value={minAge}
          options={MIN_AGES.map((a) => ({ value: a, label: tr.minAge[a] }))}
          onChange={(v) => setMinAge(v as (typeof MIN_AGES)[number])}
        />
      </div>

      {error ? (
        <EmptyState title={t.myChannel.loadError} description={error.message} />
      ) : !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : data.measuredVideos === 0 ? (
        <EmptyState title={tr.emptyTitle} description={tr.emptyHint} />
      ) : data.videos.length === 0 ? (
        <EmptyState title={tr.noneTitle} description={tr.noneHint} />
      ) : (
        <Card className="gap-0 px-2 py-2">
          {data.videos.map((video) => (
            <MyVideoRow
              key={video.id}
              video={video}
              aside={<RevivalAside video={video} scale={scale} onReport={() => setReportVideo(video)} />}
            />
          ))}
        </Card>
      )}

      <ReportDialog video={reportVideo} onOpenChange={(open) => !open && setReportVideo(null)} />
    </div>
  );
}
