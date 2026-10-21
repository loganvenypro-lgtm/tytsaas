"use client";

import { useEffect, useState } from "react";
import { Clock, Info, Loader2, PlaySquare, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, FilterSelect, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { useOptionLabels } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";
import { SimilarChannelsSheet } from "@/components/breakout-creators/similar-channels-sheet";

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
  const [similarOf, setSimilarOf] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  }, [params, page]);

  const set = (key: keyof typeof DEFAULTS) => (value: string) => {
    setPage(0);
    setParams((p) => ({ ...p, [key]: value }));
  };

  if (error instanceof SessionExpiredError) return <SessionExpiredState />;

  return (
    <div className="flex flex-col gap-6">
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
        {!loading && <span className="ml-auto text-sm text-muted-foreground">{compact(total)} {tn.noun}</span>}
      </div>

      {error && <EmptyState title={error.message} description="" />}
      {!error && !loading && items.length === 0 && <EmptyState title={tn.empty} description="" />}

      <div className="flex flex-col gap-4">
        {items.map((channel) => (
          <NicheCard key={channel.id} channel={channel} onSimilar={() => setSimilarOf({ id: channel.id, name: channel.name })} />
        ))}
        {loading && page === 0 && [0, 1].map((i) => <Skeleton key={i} className="h-[420px] rounded-2xl" />)}
      </div>

      {hasMore && (
        <Button variant="outline" className="self-center" disabled={loading} onClick={() => setPage((p) => p + 1)}>
          {loading && <Loader2 className="size-4 animate-spin" />}
          {tn.loadMore}
        </Button>
      )}

      <SimilarChannelsSheet channel={similarOf} onOpenChange={(open) => !open && setSimilarOf(null)} />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{children}</div>
    </div>
  );
}

function NicheCard({ channel: c, onSimilar }: { channel: NicheChannel; onSimilar: () => void }) {
  const { t, compact, ago, language } = useI18n();
  const tn = t.nicheFinder;
  const labels = useOptionLabels("channels");
  const revenue = c.monetization.monthlyRevenue;
  const money = (n: number) => `$${compact(n)}`;
  const niches = [labels("niche", c.niche), labels("subNiche", c.subNiche), ...c.keywords].filter(
    (v, i, all): v is string => Boolean(v) && all.indexOf(v) === i,
  );
  const channelUrl = `https://www.youtube.com/channel/${c.id}`;

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl p-0">
      {/* Header: identity and key figures */}
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
        <a href={channelUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3 lg:w-64">
          <Avatar className="size-14">
            <AvatarImage src={c.avatar ?? undefined} alt="" />
            <AvatarFallback>{c.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-semibold">{c.name}</div>
            {c.handle && <div className="truncate text-xs text-muted-foreground">{c.handle}</div>}
          </div>
        </a>
        <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-9">
          <Stat label={tn.subscribers}>{compact(c.subscribers)}</Stat>
          <Stat label={tn.revenue}>{revenue ? `${money(revenue.low)} - ${money(revenue.high)}` : "—"}</Stat>
          <Stat label={tn.rpm}>{c.rpm != null ? `$${c.rpm.toFixed(2)}` : "—"}</Stat>
          <Stat label={tn.activeSince}>{c.createdAt ? ago(c.createdAt, "day") : "—"}</Stat>
          <Stat label={tn.totalVideos}>{c.totalVideos ?? "—"}</Stat>
          <Stat label={tn.typicalViews}>{c.typicalViews ? compact(c.typicalViews) : "—"}</Stat>
          <Stat label={tn.language}>{c.language ? language(c.language) : "—"}</Stat>
          <Stat label={tn.content}>
            <span className="inline-flex items-center gap-1">
              <PlaySquare className="size-4 text-red-600" />
              {c.content === "short" ? tn.shorts : tn.longForm}
            </span>
          </Stat>
          <Stat label={tn.spotted}>{c.spottedAt ? ago(c.spottedAt, "day") : "—"}</Stat>
        </div>
      </div>

      {/* Best videos */}
      <div className="grid gap-3 border-t p-5 sm:grid-cols-2 lg:grid-cols-4">
        {c.videos.map((v) => (
          <a
            key={v.id}
            href={`https://youtu.be/${v.id}`}
            target="_blank"
            rel="noreferrer"
            className="group rounded-xl bg-muted/50 p-2 transition-colors hover:bg-muted"
          >
            <img src={v.thumbnail} alt="" className="aspect-video w-full rounded-lg object-cover" loading="lazy" />
            <div className="mt-2 line-clamp-2 px-1 text-sm">{v.title}</div>
            <div className="mt-2 flex items-center gap-2 px-1 pb-1 text-xs text-muted-foreground">
              {v.multiplier != null && v.multiplier >= 3 && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3" />
                  {tn.outlier}
                </Badge>
              )}
              <span className="font-medium text-foreground">{compact(v.views)}</span>
              <span className="ml-auto inline-flex items-center gap-1">
                <Clock className="size-3" />
                {ago(v.publishedAt, "day")}
              </span>
            </div>
          </a>
        ))}
      </div>

      {/* Insights */}
      {c.insights.length > 0 && (
        <div className="border-t px-5 py-4">
          <div className="mb-2 text-sm text-muted-foreground">{tn.insights}</div>
          <div className="flex flex-wrap gap-2">
            {c.insights.map((key) => (
              <Tooltip key={key}>
                <TooltipTrigger
                  render={
                    <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-sm">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      {tn.insight[key][0]}
                      <Info className="size-3.5 text-muted-foreground" />
                    </Badge>
                  }
                />
                <TooltipContent>{tn.insight[key][1]}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Niches */}
      {niches.length > 0 && (
        <div className="border-t px-5 py-4">
          <div className="mb-2 text-sm text-muted-foreground">{tn.niches}</div>
          <div className="flex flex-wrap gap-2">
            {niches.map((n) => (
              <Badge key={n} variant="outline" className="rounded-md px-3 py-1 text-sm font-normal capitalize">
                {n}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Footer: the demand signal */}
      <div className="flex flex-wrap items-center gap-3 border-t px-5 py-3">
        <Badge className="bg-red-600 text-white hover:bg-red-600">{c.ratio}x</Badge>
        <span className="text-sm text-muted-foreground">{tn.avgVsSubs(compact(c.avgViews), compact(c.subscribers))}</span>
        <Button size="sm" className="ml-auto" onClick={onSimilar}>
          {tn.similar}
        </Button>
      </div>
    </Card>
  );
}
