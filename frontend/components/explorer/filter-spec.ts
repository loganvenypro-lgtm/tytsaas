"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import type { Locale } from "@/lib/i18n";
import { fetchJson } from "./explorer-ui";

// Shape of GET /api/filters/:kind (lib/filterSpec.js describeSpec on the backend).
// The explorers render their controls from it: nothing here lists filters or options.

export type SpecLabel = Partial<Record<Locale, string>> & { en: string };

export interface SpecOption {
  value: string | number;
  label: SpecLabel;
  count?: number;
  /** Value of the option it belongs to in another filter (sub-niche → niche). */
  parent?: string;
}

export interface SpecPreset {
  value: string;
  label: SpecLabel;
  min?: number;
  max?: number;
}

export interface SpecFilter {
  key: string;
  type: "text" | "choice" | "enum" | "tags" | "range" | "bool";
  label: SpecLabel;
  /** Range only: [min param, max param]. */
  params?: [string, string];
  unit?: string | null;
  presets?: SpecPreset[] | null;
  default?: string | boolean | null;
  options?: SpecOption[];
}

export interface FilterSpec {
  filters: SpecFilter[];
  sorts: { value: string; label: SpecLabel }[];
  defaultSort: string;
}

export type SpecKind = "videos" | "channels";

// One request per kind for the whole page (cards and explorers share it); the backend caches counts for 10 min.
const specCache = new Map<SpecKind, Promise<FilterSpec>>();

function loadSpec(kind: SpecKind): Promise<FilterSpec> {
  let promise = specCache.get(kind);
  if (!promise) {
    promise = fetchJson<FilterSpec>(`/api/filters/${kind}`);
    promise.catch(() => specCache.delete(kind));
    specCache.set(kind, promise);
  }
  return promise;
}

export function useFilterSpec(kind: SpecKind) {
  const [state, setState] = useState<{ spec: FilterSpec | null; error: Error | null }>({ spec: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadSpec(kind)
      .then((spec) => !cancelled && setState({ spec, error: null }))
      .catch((error: Error) => !cancelled && setState({ spec: null, error }));
    return () => {
      cancelled = true;
    };
  }, [kind, attempt]);
  const retry = useCallback(() => {
    setState({ spec: null, error: null });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}

export function localize(label: SpecLabel | null | undefined, locale: Locale): string {
  if (!label) return "";
  return label[locale] ?? label.en;
}

/** URL params a filter reads (a range has two). */
export function paramsOf(filter: SpecFilter): string[] {
  return filter.type === "range" ? (filter.params ?? []) : [filter.key];
}

/** The value the backend applies when the param is absent, as it would appear in the URL. */
export function specDefault(spec: FilterSpec | null, param: string): string {
  if (!spec) return "";
  if (param === "sort") return spec.defaultSort;
  const filter = spec.filters.find((f) => f.key === param);
  if (!filter || filter.default == null) return "";
  return String(filter.default);
}

/** The filter whose options are the parents of this filter's options (niche for sub-niche). */
export function parentFilter(spec: FilterSpec, filter: SpecFilter): SpecFilter | null {
  const parent = filter.options?.find((o) => o.parent)?.parent;
  if (!parent) return null;
  return spec.filters.find((f) => f !== filter && f.options?.some((o) => String(o.value) === parent)) ?? null;
}

export const splitList = (value: string) => (value ? value.split(",").filter(Boolean) : []);

/** value → label of one filter's option, in the current language ("gaming" → "Gaming"). */
export function useOptionLabels(kind: SpecKind) {
  const { spec } = useFilterSpec(kind);
  const { locale } = useI18n();
  return useMemo(() => {
    const byKey = new Map<string, Map<string, SpecLabel>>();
    for (const filter of spec?.filters ?? []) {
      if (filter.options) byKey.set(filter.key, new Map(filter.options.map((o) => [String(o.value), o.label])));
    }
    return (key: string, value: string | number | null | undefined): string | null => {
      if (value == null || value === "") return null;
      const label = byKey.get(key)?.get(String(value));
      return label ? localize(label, locale) : null;
    };
  }, [spec, locale]);
}

/**
 * Filter state kept in the URL query string, under the backend's own param names.
 * Only values that differ from the baseline (explorer overrides, else the spec default)
 * are written, so links stay short; everything else is forwarded as-is to the API.
 */
const NONE: Record<string, string> = {};
const NO_PARAMS: string[] = [];

export function useUrlFilters({
  spec,
  overrides = NONE,
  uiParams = NO_PARAMS,
}: {
  spec: FilterSpec | null;
  /** Baseline values that differ from the backend defaults (e.g. a tab sorting by date). */
  overrides?: Record<string, string>;
  /** Params that only drive the page (tabs) and are not sent to the API. */
  uiParams?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const baseline = useCallback((param: string) => overrides[param] ?? specDefault(spec, param), [overrides, spec]);
  const value = useCallback((param: string) => url.get(param) ?? baseline(param), [url, baseline]);

  const replace = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  /** Set or clear several params at once; null, "" or the baseline value removes the param. */
  const setMany = useCallback(
    (updates: Record<string, string | null>, from: URLSearchParams = url) => {
      const next = new URLSearchParams(from);
      for (const [param, v] of Object.entries(updates)) {
        if (v == null || v === "" || v === baseline(param)) next.delete(param);
        else next.set(param, v);
      }
      replace(next);
    },
    [url, baseline, replace],
  );

  /** Clear every filter, keeping the params listed (tab, sort…). */
  const reset = useCallback(
    (keep: string[] = [], updates: Record<string, string | null> = {}) => {
      const kept = new URLSearchParams();
      for (const param of keep) {
        const v = url.get(param);
        if (v != null) kept.set(param, v);
      }
      setMany(updates, kept);
    },
    [url, setMany],
  );

  const apiParams = useCallback(
    (page: number) => {
      const params = new URLSearchParams(overrides);
      for (const [param, v] of url) if (!uiParams.includes(param)) params.set(param, v);
      params.set("page", String(page));
      return params;
    },
    [overrides, url, uiParams],
  );

  // Old links used a size bucket (?subs=small): turn it into the range params of the matching preset.
  const legacySubs = url.get("subs");
  useEffect(() => {
    if (!legacySubs || !spec) return;
    const filter = spec.filters.find((f) => f.key === "subs" && f.type === "range");
    const preset = filter?.presets?.find((p) => p.value === legacySubs);
    const [minParam, maxParam] = filter?.params ?? [];
    setMany({
      subs: null,
      ...(preset && minParam && maxParam
        ? { [minParam]: preset.min != null ? String(preset.min) : null, [maxParam]: preset.max != null ? String(preset.max) : null }
        : {}),
    });
  }, [legacySubs, spec, setMany]);

  return useMemo(() => ({ url, value, baseline, setMany, reset, apiParams }), [url, value, baseline, setMany, reset, apiParams]);
}

export type UrlFilters = ReturnType<typeof useUrlFilters>;
