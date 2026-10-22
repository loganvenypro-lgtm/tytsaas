"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { CountryFlag } from "@/components/country-flag";
import { type ChannelHit, type LookupResponse } from "@/lib/channel-search";
import { cn } from "@/lib/utils";

function ChannelRow({ channel }: { channel: ChannelHit }) {
  const { t, locale, compact } = useI18n();
  const ts = t.channelSearch;
  const body = (
    <>
      <Avatar className="size-12 shrink-0">
        {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
        <AvatarFallback>{channel.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate group-hover:underline">{channel.name}</span>
          <CountryFlag country={channel.country} />
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {channel.handle && <span>{channel.handle}</span>}
          {channel.niche && <span>{channel.niche.label[locale]}</span>}
          {!channel.inDatabase && <Badge variant="outline">{ts.notAnalysed}</Badge>}
        </span>
      </div>
      <dl className="hidden shrink-0 grid-cols-3 gap-6 text-right sm:grid">
        {[
          [t.channelSearch.header.subscribers, channel.subscribers != null ? compact(channel.subscribers) : "—"],
          [t.channelSearch.header.totalViews, channel.totalViews != null ? compact(channel.totalViews) : "—"],
          [t.channelSearch.header.videoCount, channel.videoCount != null ? compact(channel.videoCount) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex w-20 flex-col">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {!channel.inDatabase && <ExternalLink className="size-4 shrink-0 text-muted-foreground" />}
    </>
  );
  const className = "group flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring";
  return channel.inDatabase ? (
    <Link href={`/search/channels/${channel.id}`} className={className}>
      {body}
    </Link>
  ) : (
    <a href={`https://www.youtube.com/channel/${channel.id}`} target="_blank" rel="noopener noreferrer" className={className} title={ts.notAnalysedHint}>
      {body}
    </a>
  );
}

/** /search/channels: find a channel by name, @handle, UC id or link, then open its page. */
export function ChannelSearchView() {
  const { t } = useI18n();
  const ts = t.channelSearch;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";

  const [search, setSearch] = useState(q);
  const [result, setResult] = useState<{ q: string; data: LookupResponse } | null>(null);
  const [error, setError] = useState<{ q: string; error: Error } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const setQuery = (value: string) => router.replace(value ? `${pathname}?q=${encodeURIComponent(value)}` : pathname, { scroll: false });

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search.trim() === q) return;
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, q]);

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    fetchJson<LookupResponse>(`/api/channels/lookup?q=${encodeURIComponent(q)}`)
      .then((data) => !cancelled && setResult({ q, data }))
      .catch((err: Error) => !cancelled && setError({ q, error: err }));
    return () => {
      cancelled = true;
    };
  }, [q, reloadToken]);

  const data = result?.q === q ? result.data : null;
  const failed = error?.q === q ? error.error : null;
  const hits = data ? [...data.channels, ...(data.external ? [data.external] : [])] : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">{ts.title}</h2>
        <p className="text-sm text-muted-foreground">{ts.description}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ts.placeholder}
          aria-label={ts.placeholder}
          className="h-12 rounded-full pl-12 text-base md:text-base"
          maxLength={200}
          autoFocus
        />
      </form>

      {q.length < 2 ? (
        <p className="text-xs text-muted-foreground">{ts.hint}</p>
      ) : failed ? (
        failed instanceof SessionExpiredError ? (
          <SessionExpiredState />
        ) : (
          <EmptyState title={t.common.loadErrorHint} description={failed.message}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setReloadToken((n) => n + 1);
              }}
            >
              {t.common.retry}
            </Button>
          </EmptyState>
        )
      ) : !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-lg" />
          ))}
        </div>
      ) : hits.length === 0 ? (
        <EmptyState title={ts.noResults} description={ts.noResultsHint} />
      ) : (
        <section className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs text-muted-foreground">{ts.results(hits.length)}</p>
          <div className={cn("flex flex-col divide-y rounded-xl border bg-card")}>
            {hits.map((c) => (
              <ChannelRow key={c.id} channel={c} />
            ))}
          </div>
          {data.external && <p className="px-3 pt-2 text-xs text-muted-foreground">{ts.notAnalysedHint}</p>}
        </section>
      )}
    </div>
  );
}
