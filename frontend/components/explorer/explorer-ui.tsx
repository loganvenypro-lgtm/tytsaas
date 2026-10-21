"use client";

import Link from "next/link";
import { LogIn, SearchX, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";

export interface Option {
  value: string;
  label: string;
}

/** Thrown by explorer fetches when the session cookie is missing or expired. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired");
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
  return res.json();
}

export function FilterSelect({
  value,
  options,
  onChange,
  className,
  prefix,
  icon,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  prefix?: string;
  icon?: React.ReactNode;
}) {
  const items = Object.fromEntries(options.map((o) => [o.value, prefix ? `${prefix} ${o.label}` : o.label]));
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger className={className ?? "w-full sm:w-auto"}>
        {icon}
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface Topic {
  label: string;
  active: boolean;
  onPick: () => void;
}

export function TopicChips({ topics }: { topics: Topic[] }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{t.explorer.try}</span>
      {topics.map((topic) => (
        <Button
          key={topic.label}
          variant={topic.active ? "default" : "secondary"}
          size="sm"
          className="rounded-full"
          onClick={topic.onPick}
        >
          {topic.label}
        </Button>
      ))}
    </div>
  );
}

export interface ActiveChip {
  key: string;
  label: string;
}

export function ActiveFilters({
  chips,
  onRemove,
  onClear,
}: {
  chips: ActiveChip[];
  onRemove: (key: string) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="h-7 gap-1 rounded-md pr-1 pl-2.5 text-xs font-normal">
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={t.explorer.removeFilter(chip.label)}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Button variant="link" size="sm" className="h-7 px-1 text-muted-foreground" onClick={onClear}>
        {t.explorer.clearAll}
      </Button>
    </div>
  );
}


export function ResultsBar({
  loading,
  total,
  noun,
  updatedAt,
  sort,
}: {
  loading: boolean;
  total: number;
  noun: [string, string];
  updatedAt: string | null;
  sort: React.ReactNode;
}) {
  const { t, compact, ago } = useI18n();
  return (
    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">
          {loading ? t.common.loading : `${compact(total)} ${total > 1 ? noun[1] : noun[0]}`}
        </span>
        {updatedAt && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {t.time.updated(ago(updatedAt))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t.explorer.sortBy}</span>
        {sort}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SessionExpiredState() {
  const { t } = useI18n();
  return (
    <EmptyState title={t.explorer.sessionExpired.title} description={t.explorer.sessionExpired.description}>
      <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
        <LogIn className="size-4" />
        {t.explorer.sessionExpired.action}
      </Button>
    </EmptyState>
  );
}
