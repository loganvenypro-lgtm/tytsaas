"use client";

import * as React from "react";
import { BarChart3, Info, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import type { AnalyticsSummary, Growth, MyChannelStatus, OverviewResponse } from "@/lib/my-channel";
import { cn } from "@/lib/utils";
import { ConnectYoutubeButton } from "./my-channel-shell";
import { MyVideoRow } from "./my-video-row";

function Stat({
  label,
  value,
  hint,
  sub,
}: {
  label: string;
  value: string;
  hint?: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="gap-1 px-4 py-3">
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {hint && (
          <Tooltip>
            <TooltipTrigger render={<Info className="size-3 cursor-help" aria-label={hint} />} />
            <TooltipContent className="max-w-64">{hint}</TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Card>
  );
}

function GrowthLine({ growth, pick }: { growth: Growth | null; pick: (g: Growth) => number | null }) {
  const { t, compact } = useI18n();
  const value = growth ? pick(growth) : null;
  if (!growth || value == null) return <>{t.myChannel.overview.noGrowth}</>;
  const Icon = value < 0 ? TrendingDown : TrendingUp;
  return (
    <span className={cn("inline-flex items-center gap-1", value > 0 && "text-emerald-600 dark:text-emerald-400", value < 0 && "text-red-600 dark:text-red-400")}>
      <Icon className="size-3" />
      {t.myChannel.overview.growth(`${value > 0 ? "+" : ""}${compact(value)}`, growth.days)}
    </span>
  );
}

function duration(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

function AnalyticsCard({ analytics }: { analytics: AnalyticsSummary }) {
  const { t, compact, date } = useI18n();
  const ta = t.myChannel.overview.analytics;
  const max = Math.max(1, ...analytics.days.map((d) => d.views ?? 0));
  const net = analytics.subscribersGained != null && analytics.subscribersLost != null ? analytics.subscribersGained - analytics.subscribersLost : null;
  const short = (value: string) => date(value, { day: "numeric", month: "short" });

  return (
    <Card className="gap-4 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="size-4 text-muted-foreground" />
          {ta.title}
        </span>
        <span className="text-xs text-muted-foreground">{ta.range(short(analytics.startDate), short(analytics.endDate))}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          [ta.views, analytics.views != null ? compact(analytics.views) : "—"],
          [ta.watchHours, analytics.minutesWatched != null ? compact(Math.round(analytics.minutesWatched / 60)) : "—"],
          [ta.avgDuration, analytics.averageViewDuration != null ? duration(analytics.averageViewDuration) : "—"],
          [ta.netSubscribers, net != null ? `${net > 0 ? "+" : ""}${compact(net)}` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-lg font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
      {analytics.days.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{ta.dailyViews}</span>
          <div className="flex h-24 items-end gap-0.5" role="img" aria-label={ta.dailyViews}>
            {analytics.days.map((d) => (
              <Tooltip key={d.date}>
                <TooltipTrigger
                  render={
                    <div
                      className="min-h-0.5 flex-1 rounded-t-sm bg-primary/70 transition-colors hover:bg-primary"
                      style={{ height: `${((d.views ?? 0) / max) * 100}%` }}
                    />
                  }
                />
                <TooltipContent>
                  {short(d.date)} · {t.common.views(compact(d.views ?? 0))}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** /my-channel/overview: stats from the database, plus 28 days of YouTube Analytics when allowed. */
export function OverviewView({ status, reloadToken }: { status: MyChannelStatus; reloadToken: number }) {
  const { t, compact, ago } = useI18n();
  const to = t.myChannel.overview;
  const [data, setData] = React.useState<OverviewResponse | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchJson<OverviewResponse>("/api/my-channel/overview")
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((err: Error) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  if (error) return <EmptyState title={t.myChannel.loadError} description={error.message} />;
  if (!data)
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
        <Skeleton className="col-span-full h-72 rounded-lg" />
      </div>
    );

  const { channel, period, growth, analytics } = data;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Stat
          label={to.subscribers}
          value={channel.subscribers != null ? compact(channel.subscribers) : "—"}
          sub={<GrowthLine growth={growth.week ?? growth.month} pick={(g) => g.subscribers} />}
        />
        <Stat
          label={to.totalViews}
          value={channel.totalViews != null ? compact(channel.totalViews) : "—"}
          sub={<GrowthLine growth={growth.week ?? growth.month} pick={(g) => g.views} />}
        />
        <Stat label={to.usualViews} hint={to.usualViewsHint} value={channel.medianViews ? compact(channel.medianViews) : "—"} />
        <Stat label={to.perWeek} value={channel.uploadsPerWeek != null ? channel.uploadsPerWeek.toFixed(1) : "—"} />
        <Stat
          label={to.hitRate}
          hint={to.hitRateHint}
          value={channel.outlierRate != null ? t.common.percent(Math.round(channel.outlierRate * 100)) : "—"}
        />
        <Stat
          label={to.outliers}
          value={String(period.outliers)}
          sub={period.bestMultiplier != null ? to.bestMultiplier(`${period.bestMultiplier.toFixed(1)}x`) : to.period}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {analytics?.status === "ok" ? (
            <AnalyticsCard analytics={analytics} />
          ) : (
            <Card className="h-full justify-center gap-3 px-4 py-6">
              <span className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="size-4 text-muted-foreground" />
                {to.analytics.title}
              </span>
              <p className="text-sm text-muted-foreground">
                {analytics?.status === "reconnect"
                  ? to.analytics.reconnect
                  : analytics?.status === "unavailable"
                    ? to.analytics.unavailable
                    : to.analytics.locked}
              </p>
              {analytics?.status !== "unavailable" && (
                <div>
                  <ConnectYoutubeButton
                    tab="overview"
                    size="sm"
                    variant="outline"
                    label={status.linkedAt ? t.myChannel.connect.reconnect : undefined}
                  />
                </div>
              )}
            </Card>
          )}
        </div>
        <Card className="gap-3 px-4 py-4">
          <span className="text-sm font-medium">{to.period}</span>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{to.uploads}</dt>
              <dd className="font-semibold tabular-nums">
                {period.uploads} <span className="text-xs font-normal text-muted-foreground">{to.shortsCount(period.shorts)}</span>
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{to.lastUpload}</dt>
              <dd className="font-semibold">{period.lastUploadAt ? ago(period.lastUploadAt, "day") : "—"}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{to.medianLong}</dt>
              <dd className="font-semibold tabular-nums">{period.medianLongViews != null ? compact(period.medianLongViews) : "—"}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-muted-foreground">{to.medianShort}</dt>
              <dd className="font-semibold tabular-nums">{period.medianShortViews != null ? compact(period.medianShortViews) : "—"}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="gap-1 px-2 py-3">
          <span className="px-2 pb-1 text-sm font-medium">{to.recent}</span>
          {data.recent.length ? (
            data.recent.map((v) => <MyVideoRow key={v.id} video={v} />)
          ) : (
            <p className="px-2 text-sm text-muted-foreground">{to.noVideos}</p>
          )}
        </Card>
        <Card className="gap-1 self-start px-2 py-3">
          <div className="flex flex-col px-2 pb-1">
            <span className="text-sm font-medium">{to.best}</span>
            <span className="text-xs text-muted-foreground">{to.bestHint}</span>
          </div>
          {data.best.length ? (
            data.best.map((v) => <MyVideoRow key={v.id} video={v} />)
          ) : (
            <p className="px-2 text-sm text-muted-foreground">{to.noVideos}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
