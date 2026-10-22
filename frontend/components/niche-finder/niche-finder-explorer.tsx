"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Info, Loader2, PlaySquare, RotateCw, Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, FilterSelect, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { useOptionLabels } from "@/components/explorer/filter-spec";
import { InfiniteScroll } from "@/components/explorer/infinite-scroll";
import { useI18n } from "@/components/i18n-provider";
import { SimilarChannelsDialog } from "@/components/breakout-creators/similar-channels-dialog";
import { SaveToFolderMenu } from "@/components/folders/save-to-folder-menu";
import { FollowMenu } from "@/components/inspirations/follow-button";
import { cn } from "@/lib/utils";

type Insight = "highProfitability" | "highDemand" | "loyalViewers" | "highCommitment";

interface NicheChannel {
  id: string;
  name: string;
  handle: string | null;
  avatar: string | null;
  subscribers: number | null;
  createdAt: string | null;
  spottedAt: string | null;
  totalVideos: number | null;
  typicalViews: number | null;
  avgViews: number;
  ratio: number;
  language: string | null;
  content: "long" | "short";
  niche: string | null;
  subNiche: string | null;
  keywords: string[];
  rpm: number | null;
  monetization: { monthlyRevenue: { low: number; high: number } | null };
  insights: Insight[];
  videos: { id: string; title: string; thumbnail: string; views: number; multiplier: number | null; publishedAt: string; isShort: boolean }[];
}

interface NicheResponse {
  total: number;
  page: number;
  hasMore: boolean;
  items: NicheChannel[];
}

const DEFAULTS = { format: "long", maxSubs: "100000", maxAgeDays: "365", minRatio: "2" };

/** Niche Finder: small recent monetized channels with an outsized views/subscribers ratio. */
export function NicheFinderExplorer() {
  const { t, compact } = useI18n();
  const tn = t.nicheFinder;
  const [params, setParams] = useState(DEFAULTS);
  const [items, setItems] = useState<NicheChannel[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [similarOf, setSimilarOf] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({
      ...(params.format !== "all" ? { format: params.format } : {}),
      maxSubs: params.maxSubs,
      maxAgeDays: params.maxAgeDays,
      minRatio: params.minRatio,
      page: String(page),
    });
    fetchJson<NicheResponse>(`/api/channels/niche-finder?${query}`)
      .then((data) => {
        if (cancelled) return;
        setItems((prev) => (page === 0 ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [params, page, attempt]);

  const set = (key: keyof typeof DEFAULTS) => (value: string) => {
    setLoading(true);
    setPage(0);
    setParams((p) => ({ ...p, [key]: value }));
  };

  if (error instanceof SessionExpiredError) return <SessionExpiredState />;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-6 md:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{tn.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{tn.description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={params.format}
          onChange={set("format")}
          options={[
            { value: "all", label: `${tn.filters.format} : ${tn.filters.all}` },
            { value: "long", label: tn.longForm },
            { value: "short", label: tn.shorts },
          ]}
        />
        <FilterSelect
          prefix={tn.filters.maxSubs}
          value={params.maxSubs}
          onChange={set("maxSubs")}
          options={["10000", "50000", "100000", "500000"].map((v) => ({ value: v, label: compact(Number(v)) }))}
        />
        <FilterSelect
          prefix={tn.filters.maxAge}
          value={params.maxAgeDays}
          onChange={set("maxAgeDays")}
          options={[3, 6, 12, 24].map((m) => ({ value: String(m * 30 + (m === 12 ? 5 : 0)), label: tn.filters.months(m) }))}
        />
        <FilterSelect
          prefix={tn.filters.minRatio}
          value={params.minRatio}
          onChange={set("minRatio")}
          options={["1", "2", "3", "5", "10"].map((v) => ({ value: v, label: `${v}x` }))}
        />
        {!loading && !error && <span className="ml-auto text-sm text-muted-foreground">{compact(total)} {tn.noun}</span>}
      </div>

      {error && (
        <EmptyState title={tn.errorTitle} description={error.message || t.folders.genericError}>
          <Button variant="outline" size="sm" disabled={loading} onClick={() => {
              setLoading(true);
              setAttempt((n) => n + 1);
            }}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
            {t.common.retry}
          </Button>
        </EmptyState>
      )}
      {!error && !loading && items.length === 0 && <EmptyState title={tn.empty} description={tn.emptyHint} />}

      <div className="flex flex-col gap-4">
        {items.map((channel) => (
          <NicheCard key={channel.id} channel={channel} onSimilar={() => setSimilarOf({ id: channel.id, name: channel.name })} />
        ))}
        {loading && page === 0 && !error && [0, 1].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
      </div>

      <InfiniteScroll
        hasMore={hasMore && !error}
        loading={loading}
        onLoadMore={() => {
          setLoading(true);
          setPage((p) => p + 1);
        }}
      />

      <SimilarChannelsDialog channel={similarOf} onOpenChange={(open) => !open && setSimilarOf(null)} />
    </div>
  );
}

/** One of the three headline figures; `accent` is reserved for the views/subscribers ratio. */
function KeyMetric({
  label,
  value,
  hint,
  accent,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl px-3 py-2 sm:py-2.5", accent ? "bg-red-600/10 ring-1 ring-red-600/20" : "bg-muted/60", className)}>
      <div className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("mt-0.5 truncate text-base font-semibold tabular-nums sm:text-xl", accent && "text-red-600 dark:text-red-500")}>
        {value}
      </div>
      {hint && <div className="truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function NicheCard({ channel: c, onSimilar }: { channel: NicheChannel; onSimilar: () => void }) {
  const { t, compact, ago, language } = useI18n();
  const tn = t.nicheFinder;
  const labels = useOptionLabels("channels");
  const revenue = c.monetization.monthlyRevenue;
  const money = (n: number) => `$${compact(n)}`;
  const channelUrl = `https://www.youtube.com/channel/${c.id}`;

  // Niche and sub-niche link to Top videos filtered on them; keywords are plain tags.
  const tags: { label: string; href?: string }[] = [];
  const seen = new Set<string>();
  const addTag = (label: string | null | undefined, href?: string) => {
    if (!label || seen.has(label.toLowerCase())) return;
    seen.add(label.toLowerCase());
    tags.push({ label, href });
  };
  if (c.niche) addTag(labels("niche", c.niche), `/trending/top-videos?niche=${encodeURIComponent(c.niche)}`);
  if (c.subNiche) addTag(labels("subNiche", c.subNiche), `/trending/top-videos?subNiche=${encodeURIComponent(c.subNiche)}`);
  c.keywords.forEach((k) => addTag(k));

  // Secondary facts: smaller, muted, in one wrapping line.
  const facts = [
    { label: tn.rpm, value: c.rpm != null ? `$${c.rpm.toFixed(2)}` : null },
    { label: tn.typicalViews, value: c.typicalViews ? compact(c.typicalViews) : null },
    { label: tn.totalVideos, value: c.totalVideos != null ? String(c.totalVideos) : null },
    { label: tn.activeSince, value: c.createdAt ? ago(c.createdAt, "day") : null },
    { label: tn.spotted, value: c.spottedAt ? ago(c.spottedAt, "day") : null },
  ].filter((f): f is { label: string; value: string } => f.value != null);

  const actions = (
    <>
      <Button variant="outline" onClick={onSimilar}>
        <Users className="size-4" />
        {tn.similar}
      </Button>
      <FollowMenu channelId={c.id} channelName={c.name} />
      <SaveToFolderMenu
        item={{
          type: "channel",
          id: c.id,
          snapshot: { title: c.name, thumbnail: c.avatar, handle: c.handle, subscribers: c.subscribers },
        }}
      />
    </>
  );

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl p-0 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
        {/* Identity + actions */}
        <div className="flex items-start gap-3">
          <a href={channelUrl} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="size-12 shrink-0">
              <AvatarImage src={c.avatar ?? undefined} alt="" />
              <AvatarFallback>{c.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-semibold hover:underline">{c.name}</div>
              <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                {c.handle && <span className="truncate">{c.handle}</span>}
                {c.handle && <span aria-hidden>·</span>}
                <span className="inline-flex items-center gap-1">
                  <PlaySquare className="size-3.5 text-red-600" />
                  {c.content === "short" ? tn.shorts : tn.longForm}
                </span>
                {c.language && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{language(c.language)}</span>
                  </>
                )}
              </div>
            </div>
          </a>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div>
        </div>

        {/* Headline figures */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <div>
                  <KeyMetric accent label={tn.ratio} value={`${c.ratio}x`} hint={tn.avgViews(compact(c.avgViews))} />
                </div>
              }
            />
            <TooltipContent>{tn.avgVsSubs(compact(c.avgViews), compact(c.subscribers))}</TooltipContent>
          </Tooltip>
          <KeyMetric
            className="order-last col-span-2 sm:order-none sm:col-span-1"
            label={tn.revenue}
            value={revenue ? `${money(revenue.low)}–${money(revenue.high)}` : "—"}
          />
          <KeyMetric label={tn.subscribers} value={compact(c.subscribers)} />
        </div>

        {facts.length > 0 && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline gap-1">
                <dt>{f.label}</dt>
                <dd className="font-medium text-foreground/80 tabular-nums">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* Signals and niches, grouped */}
        {(c.insights.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {c.insights.map((key) => (
              <Tooltip key={key}>
                <TooltipTrigger
                  render={
                    <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 text-xs">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {tn.insight[key][0]}
                      <Info className="size-3 text-muted-foreground" />
                    </Badge>
                  }
                />
                <TooltipContent>{tn.insight[key][1]}</TooltipContent>
              </Tooltip>
            ))}
            {c.insights.length > 0 && tags.length > 0 && <span className="mx-1 h-4 w-px bg-border" aria-hidden />}
            {tags.map((tag) =>
              tag.href ? (
                <Tooltip key={tag.label}>
                  <TooltipTrigger
                    render={
                      <Badge
                        variant="outline"
                        className="h-6 px-2.5 text-xs font-normal capitalize"
                        render={<Link href={tag.href} />}
                      >
                        {tag.label}
                      </Badge>
                    }
                  />
                  <TooltipContent>{tn.seeTopVideos}</TooltipContent>
                </Tooltip>
              ) : (
                <Badge key={tag.label} variant="outline" className="h-6 px-2.5 text-xs font-normal text-muted-foreground capitalize">
                  {tag.label}
                </Badge>
              ),
            )}
          </div>
        )}
      </div>

      {/* Best videos: a scrollable strip on mobile, a grid from sm up, a side column on lg */}
      {c.videos.length > 0 && (
        <div className="-mt-1 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-5 sm:pb-5 lg:mt-0 lg:w-[44%] lg:shrink-0 lg:content-center lg:py-5 lg:pl-0">
          {c.videos.map((v) => (
            <a
              key={v.id}
              href={`https://youtu.be/${v.id}`}
              target="_blank"
              rel="noreferrer"
              className="group w-40 shrink-0 snap-start sm:w-auto"
            >
              <div className="relative">
                <img src={v.thumbnail} alt="" className="aspect-video w-full rounded-lg object-cover" loading="lazy" />
                {v.multiplier != null && v.multiplier >= 3 && (
                  <Badge className="absolute top-1.5 left-1.5 gap-1 bg-background/90 text-foreground backdrop-blur">
                    <Sparkles className="size-3" />
                    {tn.outlier}
                  </Badge>
                )}
              </div>
              <div className="mt-1.5 line-clamp-2 text-xs leading-snug group-hover:underline">{v.title}</div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">{compact(v.views)}</span>
                <span className="ml-auto inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {ago(v.publishedAt, "day")}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Mobile: actions at the bottom, full width */}
      <div className="grid grid-cols-2 gap-2 border-t p-3 sm:hidden [&>*]:w-full">{actions}</div>
    </Card>
  );
}
