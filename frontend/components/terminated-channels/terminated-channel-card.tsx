"use client";

import { Ban, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOptionLabels } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";
import { FilterBadge } from "@/components/top-videos/outlier-card";
import { SaveToFolderMenu } from "@/components/folders/save-to-folder-menu";

export interface TerminatedChannel {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  subscribers: number | null;
  totalViews: number | null;
  totalVideos: number | null;
  medianViews: number | null;
  niche: string | null;
  subNiche: string | null;
  language: string | null;
  country: string | null;
  createdAt: string | null;
  terminatedAt: string;
  lastVideo: {
    id: string;
    title: string;
    thumbnail: string;
    views: number;
    publishedAt: string;
    isShort: boolean;
  } | null;
}

export function TerminatedBadge() {
  const { t } = useI18n();
  return (
    <Badge className="gap-1 bg-red-600 text-white">
      <Ban className="size-3" />
      {t.terminated.badge}
    </Badge>
  );
}

export function TerminatedChannelCard({
  channel,
  onFilter,
}: {
  channel: TerminatedChannel;
  /** When given, the niche badges filter the list on their value. */
  onFilter?: (key: string, value: string) => void;
}) {
  const { t, compact, ago, date, language: languageName } = useI18n();
  const labelOf = useOptionLabels("channels");
  const tt = t.terminated;
  const video = channel.lastVideo;

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-start gap-3">
        <Avatar className="size-10 grayscale">
          {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
          <AvatarFallback>{channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Stays clickable so anyone can check on YouTube that the channel is really gone */}
          <a
            href={`https://www.youtube.com/channel/${channel.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium hover:underline"
          >
            {channel.name}
          </a>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {channel.handle && <span>{channel.handle}</span>}
            {channel.createdAt && <span>· {t.time.created(ago(channel.createdAt, "day"))}</span>}
            {channel.language && <span>· {languageName(channel.language)}</span>}
            {channel.country && <span>· {channel.country}</span>}
          </div>
          <div className="flex flex-wrap gap-1">
            <TerminatedBadge />
            {channel.niche && (
              <FilterBadge filterKey="niche" value={channel.niche} label={labelOf("niche", channel.niche)} onFilter={onFilter} variant="secondary" />
            )}
            {channel.subNiche && <FilterBadge filterKey="subNiche" value={channel.subNiche} label={labelOf("subNiche", channel.subNiche)} />}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-red-500" />
                    {tt.detected(ago(channel.terminatedAt))}
                  </Badge>
                }
              />
              <TooltipContent>{date(channel.terminatedAt, { dateStyle: "medium", timeStyle: "short" })}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-2.5 text-center sm:grid-cols-4">
        <Stat value={channel.subscribers != null ? compact(channel.subscribers) : "—"} label={tt.subscribers} />
        <Stat value={channel.totalViews != null ? compact(channel.totalViews) : "—"} label={tt.totalViews} />
        <Stat value={channel.totalVideos != null ? compact(channel.totalVideos) : "—"} label={tt.totalVideos} />
        <Stat value={channel.medianViews != null ? compact(channel.medianViews) : "—"} label={tt.usualViews} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">{tt.lastVideo}</span>
        {video ? (
          <div className="flex gap-3">
            <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={video.thumbnail} alt="" loading="lazy" className="size-full object-cover grayscale" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm font-medium hover:underline"
              >
                {video.title}
              </a>
              <span className="text-xs text-muted-foreground">
                {t.common.views(compact(video.views))} · {ago(video.publishedAt, "day")}
              </span>
              <span className="text-xs text-muted-foreground">{video.isShort ? t.common.short : t.common.longVideo}</span>
            </div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">{tt.noLastVideo}</span>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<a href={`https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="size-4" />
          YouTube
        </Button>
        <SaveToFolderMenu
          item={{
            type: "channel",
            id: channel.id,
            snapshot: {
              title: channel.name,
              thumbnail: channel.avatar,
              handle: channel.handle,
              subscribers: channel.subscribers,
            },
          }}
        />
      </div>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</span>
    </div>
  );
}
