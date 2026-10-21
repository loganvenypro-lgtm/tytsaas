"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Compass, Globe, LayoutGrid, Loader2, Search, Target, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ActiveFilters,
  EmptyState,
  FilterSelect,
  ResultsBar,
  SessionExpiredError,
  SessionExpiredState,
  TopicChips,
  fetchJson,
  type ActiveChip,
  type Option,
} from "@/components/explorer/explorer-ui";
import { CATEGORY_OPTIONS, FORMAT_OPTIONS, LANGUAGE_LABELS, SUBS_OPTIONS } from "@/components/top-videos/filter-options";
import { ChannelCard, type TrendChannel } from "./channel-card";
import { SimilarChannelsSheet } from "./similar-channels-sheet";

type Key = "q" | "format" | "category" | "language" | "subs" | "age" | "hitRate" | "withOutliers" | "sort";
type Filters = Record<Key, string>;
type Variant = "trends" | "finder";

const BASE_DEFAULTS: Omit<Filters, "sort"> = {
  q: "",
  format: "all",
  category: "all",
  language: "all",
  subs: "all",
  age: "all",
  hitRate: "all",
  withOutliers: "false",
};

const AGE_OPTIONS = [
  { value: "all", label: "Tout âge de chaîne", days: null },
  { value: "3m", label: "Créée il y a < 3 mois", days: 90 },
  { value: "6m", label: "Créée il y a < 6 mois", days: 180 },
  { value: "1y", label: "Créée il y a < 1 an", days: 365 },
  { value: "2y", label: "Créée il y a < 2 ans", days: 730 },
];

const HIT_RATE_OPTIONS = [
  { value: "all", label: "Tout taux de hits", rate: null },
  { value: "10", label: "≥ 10 % de hits", rate: 0.1 },
  { value: "20", label: "≥ 20 % de hits", rate: 0.2 },
  { value: "30", label: "≥ 30 % de hits", rate: 0.3 },
];

const VARIANTS: Record<
  Variant,
  {
    title: string;
    description: string;
    icon: React.ReactNode;
    defaultSort: string;
    sortOptions: Option[];
    topics: { label: string; filters: Partial<Filters> }[];
  }
> = {
  trends: {
    title: "Breakout Creators",
    description: "Les chaînes qui prennent de l'élan en ce moment.",
    icon: <TrendingUp className="size-4 text-muted-foreground" />,
    defaultSort: "trend",
    sortOptions: [
      { value: "trend", label: "Score de tendance" },
      { value: "momentum", label: "Vues (24 h)" },
      { value: "views7d", label: "Vues des vidéos (7 j)" },
      { value: "outliers", label: "Nombre d'outliers" },
      { value: "multiplier", label: "Meilleur multiplicateur" },
      { value: "subs24h", label: "Abonnés gagnés (24 h)" },
      { value: "subscribers", label: "Abonnés" },
    ],
    topics: [
      { label: "Gaming", filters: { category: "20" } },
      { label: "Éducation", filters: { category: "27" } },
      { label: "Science & Tech", filters: { category: "28" } },
      { label: "Divertissement", filters: { category: "24" } },
      { label: "Humour", filters: { category: "23" } },
      { label: "Sport", filters: { category: "17" } },
      { label: "Chaînes émergentes", filters: { subs: "small", withOutliers: "true" } },
    ],
  },
  finder: {
    title: "Channel Finder",
    description:
      "Trouve les chaînes à étudier : jeunes chaînes qui grandissent vite, hits réguliers, niches peu saturées.",
    icon: <Compass className="size-4 text-muted-foreground" />,
    defaultSort: "opportunity",
    sortOptions: [
      { value: "opportunity", label: "Score opportunité" },
      { value: "subsPerDay", label: "Abonnés par jour" },
      { value: "outlierRate", label: "Taux de hits" },
      { value: "newest", label: "Chaînes les plus récentes" },
      { value: "trend", label: "Score de tendance" },
      { value: "subscribers", label: "Abonnés" },
    ],
    topics: [
      { label: "Créées il y a < 6 mois", filters: { age: "6m" } },
      { label: "Hits réguliers", filters: { hitRate: "20" } },
      { label: "Petites chaînes qui percent", filters: { subs: "micro", hitRate: "10" } },
      { label: "Shorts", filters: { format: "short" } },
      { label: "Vidéos longues", filters: { format: "long" } },
      { label: "Gaming", filters: { category: "20" } },
      { label: "Éducation", filters: { category: "27" } },
    ],
  },
};

interface ApiResponse {
  items: TrendChannel[];
  total: number;
  page: number;
  hasMore: boolean;
  languages: { code: string; count: number }[];
  updatedAt: string | null;
}

function toApiParams(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  params.set("format", filters.format);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.language !== "all") params.set("language", filters.language);
  const subs = SUBS_OPTIONS.find((o) => o.value === filters.subs);
  if (subs?.min != null) params.set("minSubs", String(subs.min));
  if (subs?.max != null) params.set("maxSubs", String(subs.max));
  const age = AGE_OPTIONS.find((o) => o.value === filters.age);
  if (age?.days != null) params.set("maxAgeDays", String(age.days));
  const hitRate = HIT_RATE_OPTIONS.find((o) => o.value === filters.hitRate);
  if (hitRate?.rate != null) params.set("minOutlierRate", String(hitRate.rate));
  if (filters.withOutliers === "true") params.set("withOutliers", "true");
  params.set("sort", filters.sort);
  params.set("page", String(page));
  return params;
}

export function BreakoutExplorer({ variant = "trends" }: { variant?: Variant }) {
  const config = VARIANTS[variant];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaults: Filters = useMemo(() => ({ ...BASE_DEFAULTS, sort: config.defaultSort }), [config.defaultSort]);
  const filters = useMemo(() => {
    const next = { ...defaults };
    for (const key of Object.keys(defaults) as Key[]) next[key] = searchParams.get(key) || defaults[key];
    return next;
  }, [searchParams, defaults]);
  const queryKey = toApiParams(filters, 0).toString();

  const [search, setSearch] = useState(filters.q);
  const [result, setResult] = useState<(ApiResponse & { key: string }) | null>(null);
  const [error, setError] = useState<{ key: string; error: Error } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [similarOf, setSimilarOf] = useState<{ id: string; name: string } | null>(null);
  const loading = result?.key !== queryKey && error?.key !== queryKey;

  const update = useCallback(
    (next: Filters) => {
      const params = new URLSearchParams();
      for (const key of Object.keys(defaults) as Key[]) if (next[key] !== defaults[key]) params.set(key, next[key]);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, defaults],
  );
  const set = (key: Key, value: string) => update({ ...filters, [key]: value });
  const reset = () => {
    setSearch("");
    update({ ...defaults, sort: filters.sort });
  };

  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => update({ ...filters, q: search.trim() }), 350);
    return () => clearTimeout(timer);
  }, [search, filters, update]);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ApiResponse>(`/api/channels/breakout?${queryKey}`)
      .then((data) => !cancelled && setResult({ ...data, key: queryKey }))
      .catch((err: Error) => !cancelled && setError({ key: queryKey, error: err }));
    return () => {
      cancelled = true;
    };
  }, [queryKey, reloadToken]);

  const loadMore = async () => {
    if (!result) return;
    setLoadingMore(true);
    try {
      const data = await fetchJson<ApiResponse>(`/api/channels/breakout?${toApiParams(filters, result.page + 1)}`);
      setResult((prev) => (prev && prev.key === queryKey ? { ...data, key: queryKey, items: [...prev.items, ...data.items] } : prev));
    } catch (err) {
      setError({ key: queryKey, error: err as Error });
    } finally {
      setLoadingMore(false);
    }
  };

  const languageOptions: Option[] = [
    { value: "all", label: "Toutes langues" },
    ...(result?.languages ?? []).map((l) => ({ value: l.code, label: LANGUAGE_LABELS[l.code] ?? l.code.toUpperCase() })),
  ];
  if (filters.language !== "all" && !languageOptions.some((o) => o.value === filters.language)) {
    languageOptions.push({ value: filters.language, label: LANGUAGE_LABELS[filters.language] ?? filters.language });
  }

  const chips: ActiveChip[] = [];
  const labelOf = (options: Option[], value: string) => options.find((o) => o.value === value)?.label ?? value;
  if (filters.q) chips.push({ key: "q", label: `« ${filters.q} »` });
  if (filters.format !== "all") chips.push({ key: "format", label: labelOf(FORMAT_OPTIONS, filters.format) });
  if (filters.category !== "all") chips.push({ key: "category", label: labelOf(CATEGORY_OPTIONS, filters.category) });
  if (filters.language !== "all") chips.push({ key: "language", label: labelOf(languageOptions, filters.language) });
  if (filters.subs !== "all") chips.push({ key: "subs", label: labelOf(SUBS_OPTIONS, filters.subs) });
  if (filters.age !== "all") chips.push({ key: "age", label: labelOf(AGE_OPTIONS, filters.age) });
  if (filters.hitRate !== "all") chips.push({ key: "hitRate", label: labelOf(HIT_RATE_OPTIONS, filters.hitRate) });
  if (filters.withOutliers === "true") chips.push({ key: "withOutliers", label: "Avec outliers récents" });

  const items = result?.key === queryKey ? result.items : [];

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{config.title}</h2>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une chaîne ou un @handle"
              className="h-10 pl-9"
            />
          </div>
        </div>

        <TopicChips
          topics={config.topics.map((topic) => ({
            label: topic.label,
            active: Object.entries(topic.filters).every(([k, v]) => filters[k as Key] === v),
            onPick: () => update({ ...defaults, sort: filters.sort, ...topic.filters }),
          }))}
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filtrer par</span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[filters.format]}
              onValueChange={(v: string[]) => v[0] && set("format", v[0])}
              className="col-span-2"
            >
              {FORMAT_OPTIONS.map((o) => (
                <ToggleGroupItem
                  key={o.value}
                  value={o.value}
                  className="px-3 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
                >
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FilterSelect
              value={filters.category}
              options={CATEGORY_OPTIONS}
              onChange={(v) => set("category", v)}
              icon={<LayoutGrid className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.language}
              options={languageOptions}
              onChange={(v) => set("language", v)}
              icon={<Globe className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.subs}
              options={SUBS_OPTIONS}
              onChange={(v) => set("subs", v)}
              icon={<Users className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.age}
              options={AGE_OPTIONS}
              onChange={(v) => set("age", v)}
              icon={<CalendarClock className="size-3.5 text-muted-foreground" />}
            />
            <FilterSelect
              value={filters.hitRate}
              options={HIT_RATE_OPTIONS}
              onChange={(v) => set("hitRate", v)}
              icon={<Target className="size-3.5 text-muted-foreground" />}
            />
            <Toggle
              variant="outline"
              pressed={filters.withOutliers === "true"}
              onPressedChange={(pressed: boolean) => set("withOutliers", pressed ? "true" : "false")}
              className="px-2.5 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
            >
              Avec outliers récents
            </Toggle>
          </div>
        </div>

        <ActiveFilters
          chips={chips}
          onRemove={(key) => {
            if (key === "q") setSearch("");
            set(key as Key, defaults[key as Key]);
          }}
          onClear={reset}
        />

        <ResultsBar
          loading={loading}
          total={result?.key === queryKey ? result.total : 0}
          noun={["chaîne trouvée", "chaînes trouvées"]}
          updatedAt={result?.updatedAt ?? null}
          sort={
            <FilterSelect value={filters.sort} options={config.sortOptions} onChange={(v) => set("sort", v)} className="w-auto" />
          }
        />

        {error?.key === queryKey ? (
          error.error instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title="Impossible de charger les chaînes" description={error.error.message}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setReloadToken((n) => n + 1);
                }}
              >
                Réessayer
              </Button>
            </EmptyState>
          )
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[440px] rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Aucune chaîne ne correspond" description="Retire quelques filtres pour voir plus de chaînes.">
            <Button variant="outline" size="sm" onClick={reset}>
              Réinitialiser les filtres
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {items.map((channel, i) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  rank={i + 1}
                  variant={variant}
                  onSimilar={() => setSimilarOf({ id: channel.id, name: channel.name })}
                />
              ))}
            </div>
            {result?.hasMore && (
              <div className="flex justify-center pb-4">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="size-4 animate-spin" />}
                  Afficher plus
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <SimilarChannelsSheet channel={similarOf} onOpenChange={(open) => !open && setSimilarOf(null)} />
    </div>
  );
}
