"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, ExternalLink, Flame, Radar, Sparkles, TrendingUp, Tv, Users, Video } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { OutlierCard, type OutlierVideo } from "@/components/top-videos/outlier-card";
import { cn } from "@/lib/utils";

interface HomeData {
  userName: string;
  myChannel: {
    id: string;
    name: string;
    handle: string | null;
    avatar: string | null;
    subscribers: number | null;
    trendScore: number | null;
    outlierRate: number | null;
    uploads30d: number;
    subs24h: number | null;
    views24h: number | null;
    latestVideo: OutlierVideo | null;
    bestRecentVideo: OutlierVideo | null;
  } | null;
  niche: { keywords: string[] };
  forYou: OutlierVideo[];
  competitors: {
    id: string;
    name: string;
    avatar: string | null;
    subscribers: number | null;
    trendScore: number | null;
    bestVideo: { id: string; title: string; views: number; multiplier: number | null; publishedAt: string } | null;
  }[];
  competitorHits: OutlierVideo[];
  pulse: { videos24h: number; outliers24h: number; newChannels24h: number; channels: number };
  updatedAt: string | null;
}

const youtubeChannel = (id: string) => `https://www.youtube.com/channel/${id}`;
const topVideosSearch = (q: string) => `/trending/top-videos?q=${encodeURIComponent(q)}`;

/** Signed-in home: pulse of the database, my channel, hits in my niche and my competitors. */
export function HomeView() {
  const { t, ago } = useI18n();
  const th = t.home;
  const [result, setResult] = useState<{ data?: HomeData; error?: Error } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<HomeData>("/api/home")
      .then((data) => !cancelled && setResult({ data }))
      .catch((error: Error) => !cancelled && setResult({ error }));
    return () => {
      cancelled = true;
    };
  }, []);

  const data = result?.data;

  if (result?.error) {
    return (
      <Page>
        {result.error instanceof SessionExpiredError ? (
          <SessionExpiredState />
        ) : (
          <EmptyState title={th.loadError} description={t.common.loadErrorHint} />
        )}
      </Page>
    );
  }
  if (!data) {
    return (
      <Page>
        <HomeSkeleton />
      </Page>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 6 ? th.greeting.night : hour < 18 ? th.greeting.morning : th.greeting.evening;
  const firstKeyword = data.niche.keywords[0];

  return (
    <Page>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {greeting} {data.userName.split(" ")[0]}
          </h2>
          <p className="text-sm text-muted-foreground">{data.myChannel ? th.subtitleWithChannel : th.subtitle}</p>
        </div>
        {data.updatedAt && (
          <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {th.updated(ago(data.updatedAt))}
          </Badge>
        )}
      </div>

      <PulseCards pulse={data.pulse} />

      {data.myChannel ? <MyChannelCard channel={data.myChannel} /> : <ConnectChannelCard />}

      <section className="flex flex-col gap-4">
        <SectionTitle
          icon={<Sparkles />}
          title={data.myChannel ? th.forYou.titleWithChannel : th.forYou.title}
          description={th.forYou.description}
          href={firstKeyword ? topVideosSearch(firstKeyword) : "/trending/top-videos"}
        />
        {data.niche.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.niche.keywords.slice(0, 8).map((k) => (
              <Badge key={k} variant="secondary" className="font-normal" render={<Link href={topVideosSearch(k)} />}>
                {k}
              </Badge>
            ))}
          </div>
        )}
        {data.forYou.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {data.forYou.map((video) => (
              <OutlierCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <EmptyState title={th.forYou.emptyTitle} description={th.forYou.emptyDescription} />
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <CompetitorsCard competitors={data.competitors} />
        <div className="flex flex-col gap-4">
          <SectionTitle icon={<Flame />} title={th.competitorHits.title} description={th.competitorHits.description} />
          {data.competitorHits.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.competitorHits.map((video) => (
                <OutlierCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <EmptyState title={th.competitorHits.emptyTitle} description={th.competitorHits.emptyDescription} />
          )}
        </div>
      </section>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-4 py-6 md:px-6">{children}</div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="flex items-center gap-2 text-lg font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {href && (
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={href} />}>
          {t.home.seeAll}
          <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );
}

function PulseCards({ pulse }: { pulse: HomeData["pulse"] }) {
  const { t, compact } = useI18n();
  const tp = t.home.pulse;
  const cards = [
    { icon: Video, label: tp.videos, hint: tp.videosHint, value: pulse.videos24h, href: "/trending/top-videos?view=all" },
    { icon: Flame, label: tp.outliers, hint: tp.outliersHint, value: pulse.outliers24h, href: "/trending/top-videos?period=24h&minMultiplier=3" },
    { icon: Radar, label: tp.newChannels, hint: tp.newChannelsHint, value: pulse.newChannels24h, href: "/trending/breakout-creators" },
    { icon: Tv, label: tp.channels, hint: tp.channelsHint, value: pulse.channels, href: "/trending/breakout-creators" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <Card className="h-full gap-2 bg-linear-to-t from-primary/5 to-card p-4 shadow-xs transition-shadow group-hover:shadow-md dark:bg-card">
            <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
              <span>{c.label}</span>
              <c.icon className="size-4 shrink-0" />
            </div>
            <span className="mt-auto text-2xl font-semibold tabular-nums sm:text-3xl">{compact(c.value)}</span>
            <span className="text-xs text-muted-foreground">{c.hint}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function MyChannelCard({ channel }: { channel: NonNullable<HomeData["myChannel"]> }) {
  const { t, compact } = useI18n();
  const tm = t.home.myChannel;
  const signed = (n: number) => `${n >= 0 ? "+" : "−"}${compact(Math.abs(n))}`;
  const metrics = [
    { label: tm.subscribers, value: channel.subscribers != null ? compact(channel.subscribers) : "—", delta: channel.subs24h },
    { label: tm.views24h, value: channel.views24h != null ? signed(channel.views24h) : "—" },
    { label: tm.uploads30d, value: String(channel.uploads30d) },
    { label: tm.hitRate, value: channel.outlierRate != null ? t.common.percent(Math.round(channel.outlierRate * 100)) : "—" },
    { label: tm.trend, value: channel.trendScore != null ? `${Math.round(channel.trendScore)}/100` : "—" },
  ];
  const showBest = channel.bestRecentVideo && channel.bestRecentVideo.id !== channel.latestVideo?.id;

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12">
            {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
            <AvatarFallback>{channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardDescription>{tm.label}</CardDescription>
            <CardTitle className="truncate text-lg">{channel.name}</CardTitle>
          </div>
        </div>
        <CardAction>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={youtubeChannel(channel.id)} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="size-4" />
            <span className="hidden sm:inline">{tm.open}</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-0.5 rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span className="flex items-baseline gap-1.5 text-xl font-semibold tabular-nums">
                {m.value}
                {m.delta != null && (
                  <span className={cn("text-xs font-medium", m.delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                    {signed(m.delta)}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        {(channel.latestVideo || showBest) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {channel.latestVideo && <MiniVideo label={tm.latest} video={channel.latestVideo} />}
            {showBest && <MiniVideo label={tm.best} video={channel.bestRecentVideo!} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniVideo({ label, video }: { label: string; video: OutlierVideo }) {
  const { t, compact, ago } = useI18n();
  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-lg border p-2 transition-colors hover:bg-muted"
    >
      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={video.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
        {video.multiplier != null && video.multiplier >= 1 && (
          <span
            className={cn(
              "absolute top-1 left-1 rounded px-1 text-[10px] font-semibold text-white",
              video.multiplier >= 3 ? "bg-emerald-600" : "bg-black/70",
            )}
          >
            {video.multiplier.toFixed(1)}x
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="line-clamp-2 text-sm font-medium">{video.title}</span>
        <span className="text-xs text-muted-foreground">
          {t.common.views(compact(video.views))} · {ago(video.publishedAt, "hour")}
        </span>
      </div>
    </a>
  );
}

function ConnectChannelCard() {
  const { t } = useI18n();
  const tc = t.home.connect;
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          {tc.title}
        </CardTitle>
        <CardDescription>{tc.description}</CardDescription>
        <CardAction>
          <Button variant="outline" nativeButton={false} render={<Link href="/trending/breakout-creators" />}>
            <Compass className="size-4" />
            <span className="hidden sm:inline">{tc.explore}</span>
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

function CompetitorsCard({ competitors }: { competitors: HomeData["competitors"] }) {
  const { t, compact } = useI18n();
  const tc = t.home.competitors;
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          {tc.title}
        </CardTitle>
        <CardDescription>{tc.description}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/channels/competitors" />}>
            {tc.manage}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {competitors.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-2 text-sm text-muted-foreground">
            {tc.empty}
            <Button size="sm" nativeButton={false} render={<Link href="/trending/breakout-creators" />}>
              <Compass className="size-4" />
              {tc.find}
            </Button>
          </div>
        ) : (
          competitors.map((c) => (
            <a
              key={c.id}
              href={youtubeChannel(c.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="-mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
            >
              <Avatar className="size-9">
                {c.avatar && <AvatarImage src={c.avatar} alt="" />}
                <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {c.bestVideo
                    ? `${c.bestVideo.multiplier != null ? `${c.bestVideo.multiplier.toFixed(1)}x · ` : ""}${c.bestVideo.title}`
                    : c.subscribers != null
                      ? t.common.subscribers(compact(c.subscribers))
                      : t.common.hiddenSubscribers}
                </span>
              </div>
              {c.trendScore != null && (
                <Badge
                  variant="outline"
                  className={cn("shrink-0 tabular-nums", c.trendScore >= 75 && "border-emerald-500/40 text-emerald-700 dark:text-emerald-400")}
                >
                  {Math.round(c.trendScore)}
                </Badge>
              )}
            </a>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </>
  );
}
