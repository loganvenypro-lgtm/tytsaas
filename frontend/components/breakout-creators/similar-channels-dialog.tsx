"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Flame, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/components/explorer/explorer-ui";
import { localize, type SpecLabel } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";

interface ProfileAxis {
  id: string;
  label: SpecLabel;
  share: number;
  /** Parent niche, on sub-niches. */
  niche?: string;
}

interface SimilarResponse {
  keywords: string[];
  profile?: {
    niches: ProfileAxis[];
    subNiches: ProfileAxis[];
    formats: ProfileAxis[];
    language: string | null;
    shortShare: number;
    medianDuration: number | null;
  };
  items: {
    id: string;
    name: string;
    handle: string | null;
    avatar: string | null;
    subscribers: number | null;
    country: string | null;
    createdAt: string | null;
    outlierRate: number | null;
    opportunityScore: number | null;
    trendScore: number | null;
    matchingVideos: number;
    niche?: SpecLabel | null;
    subNiche?: SpecLabel | null;
    sampleVideo?: { id: string; title: string } | null;
  }[];
  videos?: {
    id: string;
    title: string;
    thumbnail: string;
    views: number;
    multiplier: number | null;
    publishedAt: string;
    isShort: boolean;
    channelId: string;
    channelName: string;
  }[];
}

function languageName(code: string, locale: string) {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    return code;
  }
}

export function SimilarChannelsDialog({
  channel,
  onOpenChange,
}: {
  channel: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale, compact, ago } = useI18n();
  const ts = t.breakout.similar;
  const [result, setResult] = useState<{ id: string; data?: SimilarResponse; error?: string } | null>(null);

  useEffect(() => {
    if (!channel) return;
    let cancelled = false;
    fetchJson<SimilarResponse>(`/api/channels/${channel.id}/similar`)
      .then((data) => !cancelled && setResult({ id: channel.id, data }))
      .catch((err: Error) => !cancelled && setResult({ id: channel.id, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [channel]);

  const loaded = channel && result?.id === channel.id ? result : null;
  const profile = loaded?.data?.profile;
  // The main niche and its own sub-niches: the minor ones are often classifier noise.
  const mainNiche = profile?.niches[0];
  const profileBadges = profile
    ? [
        ...(mainNiche ? [localize(mainNiche.label, locale)] : []),
        ...profile.subNiches
          .filter((s) => s.niche === mainNiche?.id)
          .slice(0, 2)
          .map((s) => localize(s.label, locale)),
        ...profile.formats.slice(0, 1).map((f) => localize(f.label, locale)),
        profile.shortShare >= 0.6 ? ts.shorts : profile.shortShare <= 0.4 ? ts.longForm : ts.mixed,
        ...(profile.shortShare < 0.6 && profile.medianDuration ? [ts.typicalLength(Math.round(profile.medianDuration / 60))] : []),
        ...(profile.language ? [languageName(profile.language, locale)] : []),
      ]
    : [];
  const keywords = loaded?.data?.keywords.slice(0, 8) ?? [];
  const videos = loaded?.data?.videos ?? [];

  return (
    <Dialog open={channel != null} onOpenChange={(open) => onOpenChange(open)}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="gap-3 border-b p-5 pr-12">
          <div className="flex flex-col gap-1">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Users className="size-4" />
              {ts.title}
            </DialogTitle>
            <DialogDescription>{channel ? ts.description(channel.name) : ""}</DialogDescription>
          </div>
          {(profileBadges.length > 0 || keywords.length > 0) && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
              {profileBadges.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium text-muted-foreground">{ts.profile}</span>
                  {profileBadges.map((label) => (
                    <Badge key={label} variant="outline" className="bg-background font-normal">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
              {keywords.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium text-muted-foreground">{ts.keywords}</span>
                  {keywords.map((k) => (
                    <Badge key={k} variant="secondary" className="font-normal">
                      {k}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loaded?.error ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{t.common.loadErrorHint}</p>
          ) : !loaded?.data ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="aspect-video w-full" />
                ))}
              </div>
            </div>
          ) : loaded.data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{ts.empty}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="flex min-w-0 flex-col gap-2">
                <h3 className="text-sm font-medium">{ts.channels}</h3>
                {loaded.data.items.map((item) => {
                  const topic = [item.niche, item.subNiche]
                    .filter(Boolean)
                    .map((l) => localize(l, locale))
                    .join(" · ");
                  return (
                    <a
                      key={item.id}
                      href={`https://www.youtube.com/channel/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                    >
                      <Avatar className="size-10">
                        {item.avatar && <AvatarImage src={item.avatar} alt="" referrerPolicy="no-referrer" />}
                        <AvatarFallback>{item.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium">{item.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {item.subscribers != null ? t.common.subscribers(compact(item.subscribers)) : t.common.hiddenSubscribers}
                          {item.createdAt && ` · ${t.time.created(ago(item.createdAt, "day"))}`}
                          {topic && ` · ${topic}`}
                        </span>
                        {item.sampleVideo && (
                          <span className="truncate text-xs italic text-muted-foreground">{ts.example(item.sampleVideo.title)}</span>
                        )}
                      </div>
                      {item.opportunityScore != null && (
                        <Badge variant="outline" className="shrink-0 tabular-nums">
                          {Math.round(item.opportunityScore)}
                        </Badge>
                      )}
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </a>
                  );
                })}
              </section>

              {videos.length > 0 && (
                <section className="flex min-w-0 flex-col gap-2">
                  <h3 className="text-sm font-medium">{ts.videos}</h3>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    {videos.map((video) => (
                      <a
                        key={video.id}
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex min-w-0 flex-col gap-1.5"
                      >
                        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={video.thumbnail}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                          />
                          {video.multiplier != null && video.multiplier >= 1 && (
                            <span className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[10px] font-semibold text-white">
                              <Flame className="size-2.5" />
                              {video.multiplier.toFixed(1)}x
                            </span>
                          )}
                        </div>
                        <span className="line-clamp-2 text-xs font-medium leading-snug">{video.title}</span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {video.channelName} · {t.common.views(compact(video.views))}
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
