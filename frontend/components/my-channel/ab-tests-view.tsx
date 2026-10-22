"use client";

import * as React from "react";
import { ImageOff, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import type { AbTest, AbTestsResponse, VariantVersion } from "@/lib/my-channel";
import { cn } from "@/lib/utils";
import { MyVideoRow } from "./my-video-row";

/** The version with the best measured pace, when at least two versions were measured. */
function bestIndex(versions: VariantVersion[]) {
  const measured = versions.map((v, i) => [v.viewsPerHour, i] as const).filter(([vph]) => vph != null);
  if (measured.length < 2) return -1;
  return measured.reduce((best, cur) => ((cur[0] ?? 0) > (best[0] ?? 0) ? cur : best))[1];
}

function VersionMeta({ version, best }: { version: VariantVersion; best: boolean }) {
  const { t, compact, date } = useI18n();
  const ta = t.myChannel.abTests;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      {version.current && <Badge className="h-4 px-1.5 text-[10px]">{ta.current}</Badge>}
      {best && (
        <Badge variant="secondary" className="h-4 gap-0.5 bg-emerald-500/15 px-1.5 text-[10px] text-emerald-700 dark:text-emerald-300">
          <Trophy className="size-2.5" />
          {ta.best}
        </Badge>
      )}
      {version.from && <span>{ta.since(date(version.from, { day: "numeric", month: "short" }))}</span>}
      <span>{ta.live(ta.duration(version.hoursLive))}</span>
      <Tooltip>
        <TooltipTrigger
          render={
            <span className={cn("cursor-help", version.viewsPerHour != null && "font-medium text-foreground")}>
              {version.viewsPerHour != null ? ta.vph(compact(version.viewsPerHour)) : ta.noPace}
            </span>
          }
        />
        <TooltipContent className="max-w-60">{ta.vphHint}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function TestCard({ test }: { test: AbTest }) {
  const { t } = useI18n();
  const ta = t.myChannel.abTests;
  const bestTitle = bestIndex(test.titles);
  const bestThumb = bestIndex(test.thumbnails);

  return (
    <Card className="gap-3 px-2 py-3">
      <MyVideoRow video={test.video} />
      {test.thumbnails.length > 1 && (
        <div className="flex flex-col gap-2 px-2">
          <span className="text-xs font-medium text-muted-foreground">{ta.thumbnails}</span>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {test.thumbnails.map((v, i) => (
              <div
                key={`${v.from}-${i}`}
                className={cn("flex flex-col gap-1.5 rounded-lg p-1.5", v.current && "bg-primary/5 ring-1 ring-primary/30")}
              >
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-muted">
                  {v.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.image} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                      <ImageOff className="size-4" />
                      {ta.unknownImage}
                    </span>
                  )}
                </div>
                <VersionMeta version={v} best={i === bestThumb} />
              </div>
            ))}
          </div>
        </div>
      )}
      {test.titles.length > 1 && (
        <div className="flex flex-col gap-2 px-2">
          <span className="text-xs font-medium text-muted-foreground">{ta.titles}</span>
          <ol className="flex flex-col gap-2">
            {test.titles.map((v, i) => (
              <li key={`${v.from}-${i}`} className={cn("flex flex-col gap-1 rounded-lg border px-3 py-2", v.current && "border-primary/40 bg-primary/5")}>
                <span className="text-sm font-medium">{v.value}</span>
                <VersionMeta version={v} best={i === bestTitle} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

/** /my-channel/ab-tests: the title and thumbnail versions detected on the user's videos. */
export function AbTestsView({ reloadToken }: { reloadToken: number }) {
  const { t } = useI18n();
  const ta = t.myChannel.abTests;
  const [data, setData] = React.useState<AbTestsResponse | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchJson<AbTestsResponse>("/api/my-channel/ab-tests")
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((err: Error) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (error) return <EmptyState title={t.myChannel.loadError} description={error.message} />;
  if (!data)
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-lg" />
        ))}
      </div>
    );
  if (!data.tests.length) return <EmptyState title={ta.emptyTitle} description={ta.emptyHint} />;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{ta.count(data.tests.length)}</p>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        {data.tests.map((test) => (
          <TestCard key={test.video.id} test={test} />
        ))}
      </div>
    </div>
  );
}
