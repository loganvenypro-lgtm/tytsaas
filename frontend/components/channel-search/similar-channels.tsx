"use client";

import * as React from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/components/explorer/explorer-ui";
import { localize } from "@/components/explorer/filter-spec";
import { CountryFlag } from "@/components/country-flag";
import { useI18n } from "@/components/i18n-provider";
import type { SimilarResponse } from "@/lib/channel-search";

/**
 * The channel's "Similar channels" tab: what its profile was read as (topics,
 * format, language, keywords), the closest channels, which open their own page
 * here, and their videos closest to it.
 */
export function SimilarChannels({ channelId, onOpenVideo }: { channelId: string; onOpenVideo: (videoId: string) => void }) {
  const { t, locale, compact, language } = useI18n();
  const ts = t.breakout.similar;
  const [result, setResult] = React.useState<{ id: string; data?: SimilarResponse; error?: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchJson<SimilarResponse>(`/api/channels/${encodeURIComponent(channelId)}/similar`)
      .then((data) => !cancelled && setResult({ id: channelId, data }))
      .catch((err: Error) => !cancelled && setResult({ id: channelId, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const loaded = result?.id === channelId ? result : null;
  const data = loaded?.data;
  const profile = data?.profile;
  // The main niche and its own sub-niches: the minor ones are often classifier noise.
  const mainNiche = profile?.niches[0];
  const badges = profile
    ? [
        ...(mainNiche ? [localize(mainNiche.label, locale)] : []),
        ...profile.subNiches
          .filter((s) => s.niche === mainNiche?.id)
          .slice(0, 2)
          .map((s) => localize(s.label, locale)),
        ...profile.formats.slice(0, 1).map((f) => localize(f.label, locale)),
        profile.shortShare >= 0.6 ? ts.shorts : profile.shortShare <= 0.4 ? ts.longForm : ts.mixed,
        ...(profile.shortShare < 0.6 && profile.medianDuration ? [ts.typicalLength(Math.round(profile.medianDuration / 60))] : []),
        ...(profile.language ? [language(profile.language)] : []),
      ]
    : [];
  const keywords = data?.keywords.slice(0, 10) ?? [];

  if (loaded?.error) return <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">{t.common.loadErrorHint}</p>;
  if (!data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {(badges.length > 0 || keywords.length > 0) && (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-4">
          {badges.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium text-muted-foreground">{ts.profile}</span>
              {badges.map((label) => (
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

      {data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">{ts.empty}</p>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{ts.channels}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((item, i) => {
              const topic = [item.niche, item.subNiche]
                .filter(Boolean)
                .map((l) => localize(l, locale))
                .join(" · ");
              return (
                <Link
                  key={item.id}
                  href={`/search/channels/${item.id}`}
                  className="group flex gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="w-5 shrink-0 pt-3 text-right text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                  <Avatar className="size-12 shrink-0">
                    {item.avatar && <AvatarImage src={item.avatar} alt="" referrerPolicy="no-referrer" />}
                    <AvatarFallback>{item.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate group-hover:underline">{item.name}</span>
                      <CountryFlag country={item.country} />
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {item.subscribers != null ? t.common.subscribers(compact(item.subscribers)) : t.common.hiddenSubscribers}
                      {item.handle && ` · ${item.handle}`}
                    </span>
                    {topic && <span className="truncate text-xs text-muted-foreground">{topic}</span>}
                    {item.sampleVideo && <span className="line-clamp-1 text-xs italic text-muted-foreground">{ts.example(item.sampleVideo.title)}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {data.videos && data.videos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{ts.videos}</h2>
          <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.videos.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => onOpenVideo(video.id)}
                className="group flex min-w-0 flex-col gap-1.5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
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
                <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{video.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {video.channelName} · {t.common.views(compact(video.views))}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
