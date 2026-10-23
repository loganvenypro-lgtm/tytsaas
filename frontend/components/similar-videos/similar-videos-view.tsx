"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Image as ImageIcon, Layers, Search, Sparkles, Type, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  FilterSelect,
  SessionExpiredError,
  SessionExpiredState,
  fetchJson,
} from "@/components/explorer/explorer-ui";
import { OutlierCard, type OutlierVideo } from "@/components/top-videos/outlier-card";
import { useI18n } from "@/components/i18n-provider";

type Mode = "title" | "topic" | "thumbnail" | "channel";
const MODES: { value: Mode; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "title", icon: Type },
  { value: "topic", icon: Layers },
  { value: "thumbnail", icon: ImageIcon },
  { value: "channel", icon: Tv },
];
const LANGUAGES = ["fr", "en", "es", "pt", "de", "it"];

type SimilarVideo = OutlierVideo & { similarity: number };
interface ApiResponse {
  source: (Partial<OutlierVideo> & { id: string; title: string; thumbnail: string; inBase: boolean }) | null;
  query: string | null;
  items: SimilarVideo[];
  index: { backend: string; embedded: number; total: number };
}

/** An 11-character video id from an id or a youtube.com / youtu.be link (as the backend reads it). */
function parseVideoId(input: string): string | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  return text.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/)?.[1] ?? null;
}

export function SimilarVideosView() {
  const { t, compact, language: languageName } = useI18n();
  const sv = t.similarVideos;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const video = searchParams.get("video");
  const q = searchParams.get("q");
  const conceptOnly = !video && !!q;
  const requested = (searchParams.get("by") as Mode) ?? "thumbnail";
  // A concept has no channel to compare with
  const by: Mode = MODES.some((m) => m.value === requested) && !(conceptOnly && requested === "channel") ? requested : "thumbnail";
  const sort = searchParams.get("sort") === "similarity" ? "similarity" : "performance";
  const format = searchParams.get("format") ?? "all";
  const language = searchParams.get("language") ?? "all";

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "" || value === "all") next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  // The box shows what the URL searches for until the user types: a "More like this" click replaces it.
  const fromUrl = video ? `https://www.youtube.com/watch?v=${video}` : (q ?? "");
  const [draft, setDraft] = useState({ for: fromUrl, value: fromUrl });
  const input = draft.for === fromUrl ? draft.value : fromUrl;
  const setInput = (value: string) => setDraft({ for: fromUrl, value });
  const submit = (raw = input) => {
    const text = raw.trim();
    if (!text) return;
    const id = parseVideoId(text);
    set(id ? { video: id, q: null } : { q: text, video: null, by: by === "channel" ? null : by });
  };

  const params = new URLSearchParams();
  if (video) params.set("video", video);
  else if (q) params.set("q", q);
  params.set("by", by);
  params.set("sort", sort);
  if (format !== "all") params.set("format", format);
  if (language !== "all") params.set("language", language);
  const queryKey = video || q ? params.toString() : null;

  const [result, setResult] = useState<(ApiResponse & { key: string }) | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loading = !!queryKey && result?.key !== queryKey && error?.key !== queryKey;

  useEffect(() => {
    if (!queryKey) return;
    let cancelled = false;
    fetchJson<ApiResponse>(`/api/videos/similar?${queryKey}`)
      .then((data) => !cancelled && setResult({ ...data, key: queryKey }))
      .catch((err: Error) => !cancelled && setError({ key: queryKey, error: err }));
    return () => {
      cancelled = true;
    };
  }, [queryKey, reloadToken]);

  const current = result?.key === queryKey ? result : null;
  const source = current?.source;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{sv.title}</h2>
          <p className="text-sm text-muted-foreground">{sv.description}</p>
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={sv.inputPlaceholder} className="h-10 pl-9" />
          </div>
          <Button type="submit" className="h-10 bg-brand text-white hover:bg-brand-strong">
            {sv.search}
          </Button>
        </form>

        {(video || q) && (
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
            {video ? (
              loading && !source ? (
                <Skeleton className="aspect-video w-full shrink-0 rounded-lg sm:w-48" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={source?.thumbnail ?? `https://i.ytimg.com/vi/${video}/mqdefault.jpg`}
                  alt=""
                  className="aspect-video w-full shrink-0 rounded-lg object-cover sm:w-48"
                />
              )
            ) : (
              <div className="flex aspect-video w-full shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-text sm:w-48">
                <Sparkles className="size-8" />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold">
                  {video ? (source?.title ?? (loading ? "…" : video)) : sv.concept(q ?? "")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {video
                    ? [source?.channel?.name, source && !source.inBase ? sv.notInBase : null].filter(Boolean).join(" · ")
                    : sv.conceptHint}
                </p>
              </div>
              <Tabs value={by} onValueChange={(v) => set({ by: String(v) })}>
                <TabsList>
                  {MODES.filter((m) => !(conceptOnly && m.value === "channel")).map((m) => (
                    <TabsTrigger key={m.value} value={m.value} title={sv.modeHints[m.value]}>
                      <m.icon className="size-3.5" />
                      {sv.modes[m.value]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="self-start"
              title={sv.clear}
              onClick={() => {
                setInput("");
                set({ video: null, q: null, by: null });
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}

        {queryKey && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              value={sort}
              options={[
                { value: "performance", label: sv.sorts.performance },
                { value: "similarity", label: sv.sorts.similarity },
              ]}
              onChange={(v) => set({ sort: v === "performance" ? null : v })}
            />
            <FilterSelect
              value={format}
              options={(["all", "long", "short"] as const).map((v) => ({ value: v, label: sv.formats[v] }))}
              onChange={(v) => set({ format: v })}
            />
            <FilterSelect
              value={language}
              options={[{ value: "all", label: sv.anyLanguage }, ...LANGUAGES.map((l) => ({ value: l, label: languageName(l) }))]}
              onChange={(v) => set({ language: v })}
            />
            {current && (
              <span className="ml-auto text-xs text-muted-foreground">
                {sv.coverage(compact(current.index.embedded), compact(current.index.total))}
              </span>
            )}
          </div>
        )}

        {!queryKey ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-14 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand-text">
              <ImageIcon className="size-5" />
            </div>
            <div className="flex max-w-lg flex-col gap-1">
              <p className="font-semibold">{sv.introTitle}</p>
              <p className="text-sm text-muted-foreground">{sv.introDescription}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {sv.examples.map((example) => (
                <Button key={example} variant="outline" size="sm" onClick={() => submit(example)}>
                  {example}
                </Button>
              ))}
            </div>
          </div>
        ) : error?.key === queryKey ? (
          error.error instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title={sv.loadError} description={error.error.message || t.common.loadErrorHint}>
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
        ) : loading ? (
          <Grid>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex flex-col overflow-hidden rounded-xl border">
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className="flex flex-col gap-2 p-3.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </Grid>
        ) : !current?.items.length ? (
          <EmptyState title={sv.emptyTitle} description={sv.emptyDescription} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {current.items.length} {sv.noun[current.items.length > 1 ? 1 : 0]}
            </p>
            <Grid>
              {current.items.map((item) => (
                // Similarity is only meaningful between two videos (a concept scores on another scale)
                <OutlierCard key={item.id} video={item} similarity={video ? item.similarity : undefined} />
              ))}
            </Grid>
          </>
        )}
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}
