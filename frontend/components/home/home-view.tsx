"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Eye, Flame, FolderBookmark, Plus, Radar, Type } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { listFolders } from "@/components/folders/folders-client";
import { useI18n } from "@/components/i18n-provider";
import { OutlierCard, type OutlierVideo } from "@/components/top-videos/outlier-card";
import { FOLDERS_CHANGED_EVENT, type SavedFolder } from "@/lib/saved-folders";
import { cn } from "@/lib/utils";
import { WEEKLY_NEWS_OPEN_EVENT } from "@/lib/weekly-news";

interface HomeData {
  userName: string;
  myChannel: {
    id: string;
    name: string;
    handle: string | null;
    avatar: string | null;
    subscribers: number | null;
    outlierRate: number | null;
    uploads30d: number;
    subs24h: number | null;
    views24h: number | null;
    latestVideo: OutlierVideo | null;
  } | null;
  niche: { id: string | null; label: { fr: string; en: string } | null };
  forYou: OutlierVideo[];
  competitors: {
    id: string;
    name: string;
    avatar: string | null;
    subscribers: number | null;
    trendScore: number | null;
    bestVideo: { id: string; title: string; views: number; multiplier: number | null; publishedAt: string } | null;
  }[];
  updatedAt: string | null;
  sinceLastVisit: {
    since: string;
    outliers: number;
    competitorUploads: number;
    competitorHits: number;
    newChannels: number;
    myUploads: number;
    mySubs: number | null;
    myViews: number | null;
  };
}

const youtubeChannel = (id: string) => `https://www.youtube.com/channel/${id}`;

// A new visit starts after this long without loading the home page; reloads in between keep the same reference point
const VISIT_GAP_MS = 30 * 60_000;
const visitKey = (userId: string) => `home_last_visit:${userId}`;

/** Start of the previous visit (null on the first one), and records this one. */
function previousVisit(userId: string): string | null {
  try {
    const raw = localStorage.getItem(visitKey(userId));
    const saved = raw ? (JSON.parse(raw) as { previous: string | null; current: string }) : null;
    const now = new Date().toISOString();
    const sameVisit = saved && Date.now() - Date.parse(saved.current) < VISIT_GAP_MS;
    const next = { previous: sameVisit ? saved.previous : (saved?.current ?? null), current: now };
    localStorage.setItem(visitKey(userId), JSON.stringify(next));
    return next.previous;
  } catch {
    // Storage blocked or unreadable: falls back to the last 24 hours
    return null;
  }
}

/** Top Videos period that covers the time since `since` (the backend's own presets). */
function periodSince(since: string) {
  const hours = (Date.now() - Date.parse(since)) / 3_600_000;
  return hours <= 24 ? "24h" : hours <= 72 ? "3d" : hours <= 168 ? "7d" : "30d";
}

/** Signed-in home: a greeting, what changed since the last visit, and the way back into the user's work. */
export function HomeView({ userId }: { userId: string }) {
  const { t } = useI18n();
  const th = t.home;
  const [result, setResult] = useState<{ data?: HomeData; error?: Error; firstVisit?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const since = previousVisit(userId);
    fetchJson<HomeData>(since ? `/api/home?since=${encodeURIComponent(since)}` : "/api/home")
      .then((data) => !cancelled && setResult({ data, firstVisit: !since }))
      .catch((error: Error) => !cancelled && setResult({ error }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

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

  return (
    <Page>
      <section className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-14">
        {data ? <Welcome data={data} firstVisit={Boolean(result?.firstVisit)} /> : <WelcomeSkeleton />}
        {data ? data.myChannel ? <MyChannel channel={data.myChannel} /> : <ConnectChannel /> : <Skeleton className="h-72 rounded-xl" />}
      </section>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
        <Folders />
        <Shortcuts />
      </div>

      {data ? <ForYou data={data} /> : <VideosSkeleton />}

      {data && <Competitors competitors={data.competitors} />}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-14 px-4 pt-8 pb-16 md:px-8 md:pt-12">{children}</div>
    </div>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b pb-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ——— Greeting and what changed ———

/** Replaces {key} markers in a message with nodes, so numbers can be links inside a sentence. */
function fill(text: string, values: Record<string, React.ReactNode>) {
  return text.split(/\{(\w+)\}/).map((part, i) => <Fragment key={i}>{i % 2 ? values[part] : part}</Fragment>);
}

const numberLink =
  "font-semibold text-foreground tabular-nums underline decoration-emerald-500/70 decoration-2 underline-offset-[0.2em] transition-[text-decoration-color] hover:decoration-emerald-500 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function Welcome({ data, firstVisit }: { data: HomeData; firstVisit: boolean }) {
  const { t, locale, ago, compact } = useI18n();
  const th = t.home;
  const tc = th.changes;
  const changes = data.sinceLastVisit;
  const firstName = data.userName?.trim().split(/\s+/)[0] || null;
  const hour = new Date().getHours();
  const greeting = hour < 5 ? th.greeting.night(firstName) : hour < 18 ? th.greeting.morning(firstName) : th.greeting.evening(firstName);
  const niche = data.niche.id && data.niche.label ? { id: data.niche.id, label: data.niche.label[locale] } : null;
  const period = periodSince(changes.since);

  const signed = (n: number) => (
    <span className={cn("font-semibold tabular-nums", n > 0 ? "text-emerald-700 dark:text-emerald-400" : n < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
      {n > 0 ? "+" : n < 0 ? "−" : ""}
      {compact(Math.abs(n))}
    </span>
  );
  const link = (href: string, n: number) => (
    <Link href={href} className={numberLink}>
      {compact(n)}
    </Link>
  );

  const sentences: React.ReactNode[] = [];
  if (changes.outliers > 0) {
    const href = `/trending/top-videos?period=${period}&minMultiplier=3${niche ? `&niche=${encodeURIComponent(niche.id)}` : ""}`;
    sentences.push(fill(tc.outliers(changes.outliers, niche?.label ?? null), { n: link(href, changes.outliers) }));
  }
  if (changes.competitorUploads > 0) {
    sentences.push(fill(tc.competitors(changes.competitorUploads, changes.competitorHits), { n: link("/channels/competitors", changes.competitorUploads) }));
  }
  if (changes.newChannels > 0) {
    sentences.push(fill(tc.newChannels(changes.newChannels, Boolean(niche)), { n: link("/trending/niche-finder", changes.newChannels) }));
  }
  if (data.myChannel && changes.mySubs != null && changes.myViews != null && (changes.mySubs !== 0 || changes.myViews !== 0)) {
    sentences.push(fill(tc.myChannel, { subs: signed(changes.mySubs), views: signed(changes.myViews) }));
  }
  if (changes.myUploads > 0) {
    sentences.push(fill(tc.myUploads(changes.myUploads), { n: <span className="font-semibold text-foreground tabular-nums">{changes.myUploads}</span> }));
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">{greeting}</h1>
        <p className="text-base text-muted-foreground">{firstVisit ? th.sinceFirstVisit : th.sinceVisit(ago(changes.since))}</p>
      </div>

      <p className="max-w-[42rem] text-xl leading-[1.55] text-pretty text-muted-foreground sm:text-2xl sm:leading-[1.5]">
        {sentences.length > 0
          ? sentences.map((sentence, i) => (
              <Fragment key={i}>
                {i > 0 && " "}
                {sentence}
              </Fragment>
            ))
          : tc.quiet}
      </p>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {data.updatedAt && (
          <span className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            {th.updated(ago(data.updatedAt))}
          </span>
        )}
        <Button variant="link" size="sm" className="h-auto px-0 text-muted-foreground hover:text-foreground" onClick={() => window.dispatchEvent(new Event(WEEKLY_NEWS_OPEN_EVENT))}>
          <CalendarClock className="size-4" />
          {th.weeklyRecap}
        </Button>
      </div>
    </div>
  );
}

function WelcomeSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-72 max-w-full" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="flex max-w-[42rem] flex-col gap-3">
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-11/12" />
        <Skeleton className="h-7 w-2/3" />
      </div>
      <Skeleton className="h-5 w-64" />
    </div>
  );
}

// ——— My channel ———

function MyChannel({ channel }: { channel: NonNullable<HomeData["myChannel"]> }) {
  const { t, compact, ago } = useI18n();
  const tm = t.home.myChannel;
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${compact(Math.abs(n))}`;
  const rows = [
    { label: tm.subscribers, value: channel.subscribers != null ? compact(channel.subscribers) : "—", delta: channel.subs24h },
    { label: tm.views24h, value: channel.views24h != null ? signed(channel.views24h) : "—" },
    { label: tm.uploads30d, value: String(channel.uploads30d) },
    { label: tm.hitRate, value: channel.outlierRate != null ? t.common.percent(Math.round(channel.outlierRate * 100)) : "—" },
  ];
  const video = channel.latestVideo;

  return (
    <aside className="flex h-fit flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <Avatar className="size-11">
          {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
          <AvatarFallback>{channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">{tm.label}</span>
          <span className="truncate font-semibold">{channel.name}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={tm.open}
          nativeButton={false}
          render={<a href={youtubeChannel(channel.id)} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink />
        </Button>
      </div>

      <dl className="flex flex-col text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 border-t py-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="flex items-baseline gap-1.5 font-semibold tabular-nums">
              {row.delta != null && row.delta !== 0 && (
                <span className={cn("text-xs font-medium", row.delta > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {signed(row.delta)}
                </span>
              )}
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      {video && (
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group -m-1.5 flex gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted"
        >
          <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={video.thumbnail} alt="" className="size-full object-cover" loading="lazy" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">
              {tm.latest}, {ago(video.publishedAt, "hour")}
            </span>
            <span className="line-clamp-2 text-sm leading-snug font-medium">{video.title}</span>
          </div>
        </a>
      )}
    </aside>
  );
}

function ConnectChannel() {
  const { t } = useI18n();
  const tc = t.home.connect;
  return (
    <aside className="flex h-fit flex-col items-start gap-3 rounded-xl border border-dashed p-5">
      <p className="font-semibold">{tc.title}</p>
      <p className="text-sm text-muted-foreground">{tc.description}</p>
      <Button size="sm" nativeButton={false} render={<Link href="/onboarding" />}>
        <Plus className="size-4" />
        {tc.action}
      </Button>
    </aside>
  );
}

// ——— Pick up where you left off ———

const FOLDERS_SHOWN = 4;

function Folders() {
  const { t, ago } = useI18n();
  const tr = t.home.resume;
  const [state, setState] = useState<{ folders?: SavedFolder[]; error?: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listFolders()
        .then((folders) => !cancelled && setState({ folders }))
        .catch(() => !cancelled && setState({ error: true }));
    load();
    window.addEventListener(FOLDERS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(FOLDERS_CHANGED_EVENT, load);
    };
  }, []);

  const folders = state?.folders
    ? [...state.folders].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, FOLDERS_SHOWN)
    : null;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        title={tr.title}
        description={folders?.length ? tr.description : undefined}
        action={
          folders?.length ? (
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/folders" />}>
              {tr.allFolders}
            </Button>
          ) : null
        }
      />
      {state?.error ? (
        <p className="text-sm text-muted-foreground">{tr.error}</p>
      ) : !folders ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: FOLDERS_SHOWN }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-video rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <FolderBookmark className="size-5 shrink-0 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{tr.emptyTitle}</span>
              <span className="text-sm text-muted-foreground">{tr.emptyDescription}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/trending/top-videos" />}>
            {tr.emptyAction}
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4">
          {folders.map((folder) => (
            <li key={folder.id}>
              <Link
                href={`/folders/${encodeURIComponent(folder.id)}`}
                className="group flex flex-col gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <FolderMosaic previews={folder.previews} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium group-hover:underline">{folder.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tr.counts(folder.videoCount, folder.channelCount)}, {tr.edited(ago(folder.updatedAt)).toLowerCase()}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Up to four thumbnails of the folder: one fills the tile, more share it in a grid. */
function FolderMosaic({ previews }: { previews: string[] }) {
  const shown = previews.slice(0, 4);
  return (
    <div
      className={cn(
        "grid aspect-video gap-0.5 overflow-hidden rounded-lg bg-muted ring-1 ring-border transition-[box-shadow] group-hover:ring-foreground/25",
        shown.length > 1 && "grid-cols-2",
        shown.length > 2 && "grid-rows-2",
      )}
    >
      {shown.length === 0 ? (
        <div className="flex items-center justify-center">
          <FolderBookmark className="size-6 text-muted-foreground/60" />
        </div>
      ) : (
        shown.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" loading="lazy" className={cn("size-full object-cover", shown.length === 3 && i === 0 && "row-span-2")} />
        ))
      )}
    </div>
  );
}

function Shortcuts() {
  const { t } = useI18n();
  const ts = t.home.shortcuts;
  const items = [
    { href: "/trending/top-videos", icon: Flame, label: t.nav.items.topVideos, hint: ts.topVideos },
    { href: "/trending/niche-finder", icon: Radar, label: t.nav.items.nicheFinder, hint: ts.nicheFinder },
    { href: "/trending/title-formats", icon: Type, label: t.nav.items.titleFormats, hint: ts.titleFormats },
    { href: "/channels/competitors", icon: Eye, label: t.nav.items.competitors, hint: ts.competitors },
  ];
  return (
    <nav aria-label={ts.title} className="flex flex-col gap-4">
      <SectionHeader title={ts.title} />
      <ul className="-mx-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
              <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ——— Videos and competitors ———

function ForYou({ data }: { data: HomeData }) {
  const { t, locale } = useI18n();
  const tf = t.home.forYou;
  const niche = data.niche.id && data.niche.label ? data.niche : null;
  const href = niche ? `/trending/top-videos?niche=${encodeURIComponent(niche.id!)}` : "/trending/top-videos";
  const videos = data.forYou.slice(0, 8);

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        title={niche ? tf.titleWithNiche(niche.label![locale]) : tf.title}
        description={tf.description}
        action={
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={href} />}>
            {t.home.seeAll}
          </Button>
        }
      />
      {videos.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {videos.map((video) => (
            <OutlierCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <EmptyState title={tf.emptyTitle} description={tf.emptyDescription} />
      )}
    </section>
  );
}

function VideosSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function Competitors({ competitors }: { competitors: HomeData["competitors"] }) {
  const { t, compact } = useI18n();
  const tc = t.home.competitors;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title={tc.title}
        description={competitors.length ? tc.description : undefined}
        action={
          competitors.length ? (
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/channels/competitors" />}>
              {tc.manage}
            </Button>
          ) : null
        }
      />
      {competitors.length === 0 ? (
        <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
          {tc.empty}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/trending/breakout-creators" />}>
            {tc.find}
          </Button>
        </div>
      ) : (
        <ul className="-mx-2 grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {competitors.map((c) => (
            <li key={c.id}>
              <a
                href={youtubeChannel(c.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted"
              >
                <Avatar className="size-9">
                  {c.avatar && <AvatarImage src={c.avatar} alt="" />}
                  <AvatarFallback>{c.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{c.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.bestVideo ? (
                      <>
                        {c.bestVideo.multiplier != null && c.bestVideo.multiplier >= 2 && (
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">{tc.best(c.bestVideo.multiplier.toFixed(1))}</span>
                        )}
                        {c.bestVideo.multiplier != null && c.bestVideo.multiplier >= 2 && ", "}
                        {c.bestVideo.title}
                      </>
                    ) : c.subscribers != null ? (
                      t.common.subscribers(compact(c.subscribers))
                    ) : (
                      t.common.hiddenSubscribers
                    )}
                  </span>
                </div>
                {c.trendScore != null && (
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      c.trendScore >= 75 ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                    )}
                  >
                    {Math.round(c.trendScore)}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
