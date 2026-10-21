"use client";

import { CalendarDays, Eye, Flame, Globe, LayoutGrid, Sparkles, Users } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FilterSelect, type Option } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { filterOptions, type FilterKey, type Filters } from "./filter-options";

const iconClass = "size-3.5 text-muted-foreground";

export function OutlierFilters({
  filters,
  languageOptions,
  onChange,
}: {
  filters: Filters;
  languageOptions: Option[];
  onChange: (key: FilterKey, value: string) => void;
}) {
  const { t } = useI18n();
  const opts = filterOptions(t);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{t.explorer.filterBy}</span>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[filters.format]}
          onValueChange={(v: string[]) => v[0] && onChange("format", v[0])}
          className="col-span-2"
        >
          {opts.format.map((o) => (
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
          value={filters.period}
          options={opts.period}
          onChange={(v) => onChange("period", v)}
          icon={<CalendarDays className={iconClass} />}
        />
        <FilterSelect
          value={filters.category}
          options={opts.category}
          onChange={(v) => onChange("category", v)}
          icon={<LayoutGrid className={iconClass} />}
        />
        <FilterSelect
          value={filters.language}
          options={languageOptions}
          onChange={(v) => onChange("language", v)}
          icon={<Globe className={iconClass} />}
        />
        <FilterSelect
          value={filters.subs}
          options={opts.subs}
          onChange={(v) => onChange("subs", v)}
          icon={<Users className={iconClass} />}
        />
        <FilterSelect
          value={filters.minViews}
          options={opts.views}
          onChange={(v) => onChange("minViews", v)}
          icon={<Eye className={iconClass} />}
        />
        <FilterSelect
          value={filters.minMultiplier}
          options={opts.multiplier}
          onChange={(v) => onChange("minMultiplier", v)}
          icon={<Flame className={iconClass} />}
        />
        {filters.view !== "all" && (
          <Toggle
            variant="outline"
            pressed={filters.relevant === "true"}
            onPressedChange={(pressed: boolean) => onChange("relevant", pressed ? "true" : "false")}
            className="gap-1.5 px-2.5 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
          >
            <Sparkles className="size-3.5" />
            {t.filters.relevantOnly}
          </Toggle>
        )}
      </div>
    </div>
  );
}
