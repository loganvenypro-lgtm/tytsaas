"use client";

import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { FilterSelect, type ActiveChip } from "./explorer-ui";
import {
  localize,
  paramsOf,
  parentFilter,
  splitList,
  type FilterSpec,
  type SpecFilter,
  type SpecOption,
  type UrlFilters,
} from "./filter-spec";

const pressedClass = "data-[pressed]:bg-primary data-[pressed]:text-primary-foreground";
const activeTriggerClass = "border-primary/40 bg-primary/5 text-foreground";

/** Format a range bound with the filter's unit: 5x, 10 %, 3 min, 10 k… */
function useRangeFormat() {
  const { t, compact } = useI18n();
  return (n: number, unit: string | null | undefined) => {
    if (!unit) return compact(n);
    if (unit === "%") return t.common.percent(n);
    if (unit === "x" || unit.startsWith("/")) return `${n}${unit}`;
    return `${n} ${t.explorer.units[unit] ?? unit}`;
  };
}

function rangeText(filter: SpecFilter, min: string, max: string, format: ReturnType<typeof useRangeFormat>, locale: "fr" | "en") {
  const preset = filter.presets?.find((p) => String(p.min ?? "") === min && String(p.max ?? "") === max);
  if (preset) return localize(preset.label, locale);
  const a = min ? format(Number(min), filter.unit) : null;
  const b = max ? format(Number(max), filter.unit) : null;
  if (a && b) return `${a} – ${b}`;
  return a ? `≥ ${a}` : `≤ ${b}`;
}

/** Whether a filter differs from its baseline in the URL state. */
export function isActive(filter: SpecFilter, filters: UrlFilters) {
  return paramsOf(filter).some((p) => filters.value(p) !== filters.baseline(p));
}

/** Options sorted by how many results they match (unknown counts keep the backend order). */
function byCount(options: SpecOption[]) {
  if (!options.some((o) => o.count != null)) return options;
  return [...options].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}

/**
 * Every filter the backend describes, rendered by type. Text filters are left to
 * the page's search box; ranges sit behind "More filters" until one is used.
 */
export function SpecFilterBar({
  spec,
  filters,
  hidden = [],
}: {
  spec: FilterSpec;
  filters: UrlFilters;
  hidden?: string[];
}) {
  const { t, locale } = useI18n();
  const visible = spec.filters.filter((f) => f.type !== "text" && !hidden.includes(f.key));
  const main = visible.filter((f) => f.type !== "range");
  const ranges = visible.filter((f) => f.type === "range");
  const activeRanges = ranges.filter((f) => isActive(f, filters)).length;
  const [showMore, setShowMore] = useState(false);
  const moreOpen = showMore || activeRanges > 0;

  // Changing a parent (niche) drops the selected children (sub-niches) that no longer belong to it.
  const setList = (filter: SpecFilter, values: string[]) => {
    const updates: Record<string, string | null> = { [filter.key]: values.join(",") || null };
    for (const child of spec.filters) {
      if (parentFilter(spec, child) !== filter || !values.length) continue;
      const kept = splitList(filters.value(child.key)).filter((v) => {
        const parent = child.options?.find((o) => String(o.value) === v)?.parent;
        return !parent || values.includes(parent);
      });
      updates[child.key] = kept.join(",") || null;
    }
    filters.setMany(updates);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{t.explorer.filterBy}</span>
      <div className="flex flex-wrap items-center gap-2">
        {main.map((filter) => {
          const label = localize(filter.label, locale);
          switch (filter.type) {
            case "choice": {
              const options = (filter.options ?? []).map((o) => ({ value: String(o.value), label: localize(o.label, locale) }));
              const current = filters.value(filter.key);
              if (options.length <= 3) {
                return (
                  <ToggleGroup
                    key={filter.key}
                    variant="outline"
                    spacing={0}
                    value={[current]}
                    onValueChange={(v: string[]) => v[0] && filters.setMany({ [filter.key]: v[0] })}
                    aria-label={label}
                  >
                    {options.map((o) => (
                      <ToggleGroupItem key={o.value} value={o.value} className={cn("px-3", pressedClass)}>
                        {o.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                );
              }
              return (
                <FilterSelect
                  key={filter.key}
                  value={current}
                  options={options}
                  onChange={(v) => filters.setMany({ [filter.key]: v })}
                  prefix={t.explorer.chip(label, "").trim()}
                  className={cn("w-auto", current !== filters.baseline(filter.key) && activeTriggerClass)}
                />
              );
            }
            case "enum":
            case "tags":
              return (
                <OptionsFilter
                  key={filter.key}
                  spec={spec}
                  filter={filter}
                  selected={splitList(filters.value(filter.key))}
                  parentSelected={(() => {
                    const parent = parentFilter(spec, filter);
                    return parent ? splitList(filters.value(parent.key)) : [];
                  })()}
                  onChange={(values) => setList(filter, values)}
                />
              );
            case "bool": {
              const on = filters.value(filter.key) === "true";
              return (
                <Toggle
                  key={filter.key}
                  variant="outline"
                  pressed={on}
                  onPressedChange={(pressed: boolean) =>
                    filters.setMany({ [filter.key]: pressed ? "true" : filters.baseline(filter.key) === "true" ? "false" : null })
                  }
                  className={cn("px-2.5", pressedClass)}
                >
                  {label}
                </Toggle>
              );
            }
            default:
              return null;
          }
        })}
        {ranges.length > 0 && (
          <Button variant="ghost" onClick={() => setShowMore(!showMore)} aria-expanded={moreOpen}>
            <SlidersHorizontal />
            {activeRanges > 0 ? t.explorer.moreFiltersActive(activeRanges) : moreOpen ? t.explorer.fewerFilters : t.explorer.moreFilters}
          </Button>
        )}
      </div>
      {moreOpen && ranges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {ranges.map((filter) => (
            <RangeFilter key={filter.key} filter={filter} filters={filters} />
          ))}
        </div>
      )}
    </div>
  );
}

function TriggerLabel({ label, value, active }: { label: string; value: string | null; active: boolean }) {
  return (
    <>
      <span className={cn(active ? "text-muted-foreground" : "text-foreground")}>{label}</span>
      {value && <span className="max-w-40 truncate font-semibold">{value}</span>}
      <ChevronDown className="size-3.5 text-muted-foreground" />
    </>
  );
}

function OptionsFilter({
  spec,
  filter,
  selected,
  parentSelected,
  onChange,
}: {
  spec: FilterSpec;
  filter: SpecFilter;
  selected: string[];
  parentSelected: string[];
  onChange: (values: string[]) => void;
}) {
  const { t, locale, compact } = useI18n();
  const [query, setQuery] = useState("");
  const label = localize(filter.label, locale);
  const all = useMemo(() => filter.options ?? [], [filter.options]);
  const labelOf = (value: string) => {
    const option = all.find((o) => String(o.value) === value);
    return option ? localize(option.label, locale) : value;
  };

  // Children of the chosen parents only; otherwise grouped under their parent's label.
  const groups = useMemo(() => {
    const parent = parentFilter(spec, filter);
    const needle = query.trim().toLocaleLowerCase();
    const matches = (o: SpecOption) =>
      !needle || localize(o.label, locale).toLocaleLowerCase().includes(needle) || String(o.value).includes(needle);
    if (!parent) return [{ key: "", label: null as string | null, options: byCount(all.filter(matches)) }];
    const parents = byCount(parent.options ?? []).filter((p) => !parentSelected.length || parentSelected.includes(String(p.value)));
    return parents
      .map((p) => ({
        key: String(p.value),
        label: localize(p.label, locale),
        options: byCount(all.filter((o) => o.parent === String(p.value) && matches(o))),
      }))
      .filter((g) => g.options.length > 0);
  }, [spec, filter, all, parentSelected, query, locale]);

  const toggle = (value: string, on: boolean) =>
    onChange(on ? [...selected, value] : selected.filter((v) => v !== value));
  const summary = selected.length === 0 ? null : selected.length === 1 ? labelOf(selected[0]) : `${labelOf(selected[0])} +${selected.length - 1}`;
  const empty = groups.every((g) => g.options.length === 0);

  return (
    <Popover onOpenChange={(open) => !open && setQuery("")}>
      <PopoverTrigger
        render={
          <Button variant="outline" className={cn("max-w-full", selected.length > 0 && activeTriggerClass)} />
        }
      >
        <TriggerLabel label={label} value={summary} active={selected.length > 0} />
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col">
        {all.length > 8 && (
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.explorer.searchOptions(label)}
              className="h-8"
            />
          </div>
        )}
        <div className="max-h-72 overflow-y-auto p-1">
          {empty && <p className="px-2 py-6 text-center text-muted-foreground">{t.explorer.noOption}</p>}
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col">
              {group.label && (
                <span className="sticky top-0 bg-popover px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">{group.label}</span>
              )}
              {group.options.map((option) => {
                const value = String(option.value);
                const checked = selected.includes(value);
                return (
                  <label
                    key={value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent",
                      option.count === 0 && !checked && "opacity-50",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={(on: boolean) => toggle(value, on)} />
                    <span className="flex-1 truncate">{localize(option.label, locale)}</span>
                    {option.count != null && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">{compact(option.count)}</span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span className="text-muted-foreground">{t.explorer.selected(selected.length)}</span>
            <Button variant="ghost" size="sm" onClick={() => onChange([])}>
              {t.explorer.clear}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RangeFilter({ filter, filters }: { filter: SpecFilter; filters: UrlFilters }) {
  const { t, locale } = useI18n();
  const format = useRangeFormat();
  const [minParam, maxParam] = paramsOf(filter);
  const min = filters.value(minParam);
  const max = filters.value(maxParam);
  const [draft, setDraft] = useState({ min, max });
  const [open, setOpen] = useState(false);
  const active = Boolean(min || max);
  const label = localize(filter.label, locale);
  const unit = filter.unit ? (t.explorer.units[filter.unit] ?? filter.unit) : null;

  const apply = (next: { min: string; max: string }) => {
    filters.setMany({ [minParam]: next.min.trim() || null, [maxParam]: next.max.trim() || null });
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft({ min, max });
        setOpen(next);
      }}
    >
      <PopoverTrigger render={<Button variant="outline" className={cn(active && activeTriggerClass)} />}>
        <TriggerLabel label={label} value={active ? rangeText(filter, min, max, format, locale) : null} active={active} />
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3 p-3">
        <span className="font-medium">
          {label}
          {unit && <span className="font-normal text-muted-foreground"> ({unit})</span>}
        </span>
        {filter.presets && filter.presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filter.presets.map((preset) => {
              const value = { min: preset.min != null ? String(preset.min) : "", max: preset.max != null ? String(preset.max) : "" };
              const current = value.min === min && value.max === max;
              return (
                <Button key={preset.value} size="sm" variant={current ? "default" : "secondary"} onClick={() => apply(value)}>
                  {localize(preset.label, locale)}
                </Button>
              );
            })}
          </div>
        )}
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            apply(draft);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(["min", "max"] as const).map((bound) => (
              <label key={bound} className="flex flex-col gap-1 text-muted-foreground">
                {t.explorer[bound]}
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={draft[bound]}
                  onChange={(e) => setDraft({ ...draft, [bound]: e.target.value })}
                  placeholder={t.explorer.any}
                  className="h-8"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={!active} onClick={() => apply({ min: "", max: "" })}>
              {t.explorer.clear}
            </Button>
            <Button type="submit" size="sm">
              {t.explorer.apply}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** One removable chip per filter that differs from its baseline; removing it resets all its params. */
export function useSpecChips(spec: FilterSpec | null, filters: UrlFilters, hidden: string[] = []) {
  const { t, locale } = useI18n();
  const format = useRangeFormat();
  const chips: ActiveChip[] = [];
  for (const filter of spec?.filters ?? []) {
    if (hidden.includes(filter.key) || !isActive(filter, filters)) continue;
    const label = localize(filter.label, locale);
    const optionLabel = (value: string) => {
      const option = filter.options?.find((o) => String(o.value) === value);
      return option ? localize(option.label, locale) : value;
    };
    switch (filter.type) {
      case "text":
        chips.push({ key: filter.key, label: t.common.quoted(filters.value(filter.key)) });
        break;
      case "choice":
        chips.push({ key: filter.key, label: optionLabel(filters.value(filter.key)) });
        break;
      case "enum":
      case "tags": {
        const values = splitList(filters.value(filter.key)).map(optionLabel);
        const shown = values.length > 2 ? `${values.slice(0, 2).join(", ")} +${values.length - 2}` : values.join(", ");
        chips.push({ key: filter.key, label: t.explorer.chip(label, shown) });
        break;
      }
      case "range": {
        const [minParam, maxParam] = paramsOf(filter);
        chips.push({ key: filter.key, label: `${label} ${rangeText(filter, filters.value(minParam), filters.value(maxParam), format, locale)}` });
        break;
      }
      case "bool":
        chips.push({ key: filter.key, label: filters.value(filter.key) === "true" ? label : t.explorer.off(label) });
        break;
    }
  }

  const remove = (key: string) => {
    const filter = spec?.filters.find((f) => f.key === key);
    if (filter) filters.setMany(Object.fromEntries(paramsOf(filter).map((p) => [p, null])));
  };

  return { chips, remove };
}

/** The options of a filter that match the most results, for quick "Try:" chips. */
export function topOptions(spec: FilterSpec | null, key: string, n: number): SpecOption[] {
  const options = spec?.filters.find((f) => f.key === key)?.options ?? [];
  return byCount(options)
    .filter((o) => (o.count ?? 1) > 0)
    .slice(0, n);
}

/** The filter bar, or its loading / error state while GET /api/filters/:kind answers. */
export function SpecFilterSection({
  spec,
  error,
  onRetry,
  ...props
}: Omit<React.ComponentProps<typeof SpecFilterBar>, "spec"> & {
  spec: FilterSpec | null;
  error: Error | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (spec) return <SpecFilterBar spec={spec} {...props} />;
  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <X className="size-3.5" />
        {t.explorer.filtersUnavailable}
        <Button variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
          {t.common.retry}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-7 w-24" />
      ))}
    </div>
  );
}
