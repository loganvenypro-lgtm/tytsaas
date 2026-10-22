"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/explorer/explorer-ui";
import { localize, useFilterSpec } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";
import {
  createAlert,
  previewAlert,
  updateAlert,
  type AlertFilters,
  type AlertFrequency,
  type AlertInput,
  type AlertRule,
  type AlertSource,
} from "@/lib/alerts";
import type { OutlierVideo } from "@/components/top-videos/outlier-card";
import { cn } from "@/lib/utils";
import { AlertVideoRow } from "./alert-video-row";

const SOURCES: AlertSource[] = ["all", "competitors", "inspirations"];
const FREQUENCIES: AlertFrequency[] = ["instant", "daily", "weekly"];
const MULTIPLIERS = ["2", "3", "5", "10"];
const ANY = "any";

/** Create or edit an alert, with a live preview of the videos it matches right now. */
export function AlertEditor({
  open,
  onOpenChange,
  alert,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The alert being edited; none to create one. */
  alert: AlertRule | null;
  /** Prefill for a new alert (from a template). */
  initial?: Partial<AlertInput>;
  onSaved: (alert: AlertRule) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {open && <AlertForm alert={alert} initial={initial} onCancel={() => onOpenChange(false)} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function AlertForm({
  alert,
  initial,
  onCancel,
  onSaved,
}: {
  alert: AlertRule | null;
  initial?: Partial<AlertInput>;
  onCancel: () => void;
  onSaved: (alert: AlertRule) => void;
}) {
  const { t, locale } = useI18n();
  const ta = t.alerts;
  const te = ta.editor;
  const { spec } = useFilterSpec("videos");

  const [name, setName] = React.useState(alert?.name ?? initial?.name ?? "");
  const [filters, setFilters] = React.useState<AlertFilters>(alert?.filters ?? initial?.filters ?? {});
  const [source, setSource] = React.useState<AlertSource>(alert?.source ?? initial?.source ?? "all");
  const [frequency, setFrequency] = React.useState<AlertFrequency>(alert?.frequency ?? initial?.frequency ?? "instant");
  // Empty: keep the current webhook (when editing) or none
  const [webhook, setWebhook] = React.useState("");
  const [removeWebhook, setRemoveWebhook] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = (key: keyof AlertFilters, value: string) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: value.trim() };
      if (!next[key]) delete next[key];
      if (key === "niche") delete next.subNiche;
      return next;
    });

  const options = (key: string) =>
    (spec?.filters.find((f) => f.key === key)?.options ?? []).map((o) => ({
      value: String(o.value),
      label: localize(o.label, locale),
      parent: o.parent,
    }));
  const niches = options("niche");
  const subNiches = options("subNiche").filter((o) => !filters.niche || o.parent === filters.niche);
  const languages = options("language");

  // Live preview, debounced
  const rule: AlertInput = { name: name.trim() || "…", filters, source, frequency };
  const ruleKey = JSON.stringify({ filters, source });
  const [preview, setPreview] = React.useState<{ key: string; items: OutlierVideo[]; total: number; narrow: boolean } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const { filters: f, source: s } = JSON.parse(ruleKey) as Pick<AlertInput, "filters" | "source">;
      previewAlert({ name: "preview", filters: f, source: s, frequency: "instant" })
        .then((data) => !cancelled && setPreview({ key: ruleKey, ...data }))
        .catch(() => !cancelled && setPreview({ key: ruleKey, items: [], total: 0, narrow: true }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ruleKey]);
  const previewLoading = preview?.key !== ruleKey;
  const vphScale = Math.max(1, ...(preview?.items ?? []).map((v) => v.viewsPerHour ?? 0));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input: AlertInput = {
      ...rule,
      name: name.trim(),
      ...(webhook.trim() ? { discordWebhook: webhook.trim() } : removeWebhook ? { discordWebhook: null } : {}),
    };
    try {
      onSaved(alert ? await updateAlert(alert.id, input) : await createAlert(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : ta.genericError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{alert ? te.editTitle : te.createTitle}</DialogTitle>
        <DialogDescription>{te.description}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={te.name} className="sm:col-span-2">
          <Input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={te.namePlaceholder} required />
        </Field>
        <Field label={te.keywords} hint={te.keywordsHint}>
          <Input value={filters.q ?? ""} maxLength={100} onChange={(e) => set("q", e.target.value)} placeholder={te.keywordsPlaceholder} />
        </Field>
        <Field label={te.source}>
          <FilterSelect value={source} options={SOURCES.map((s) => ({ value: s, label: ta.sources[s] }))} onChange={(v) => setSource(v as AlertSource)} className="w-full" />
        </Field>
        <Field label={te.niche}>
          <FilterSelect
            value={filters.niche ?? ANY}
            options={[{ value: ANY, label: te.anyNiche }, ...niches]}
            onChange={(v) => set("niche", v === ANY ? "" : v)}
            className="w-full"
          />
        </Field>
        <Field label={te.subNiche}>
          <FilterSelect
            value={filters.subNiche ?? ANY}
            options={[{ value: ANY, label: te.anySubNiche }, ...subNiches]}
            onChange={(v) => set("subNiche", v === ANY ? "" : v)}
            className="w-full"
          />
        </Field>
        <Field label={te.format}>
          <FilterSelect
            value={filters.format ?? "all"}
            options={(["all", "long", "short"] as const).map((f) => ({ value: f, label: t.inspirations.formats[f] }))}
            onChange={(v) => set("format", v === "all" ? "" : v)}
            className="w-full"
          />
        </Field>
        <Field label={te.language}>
          <FilterSelect
            value={filters.language ?? ANY}
            options={[{ value: ANY, label: te.anyLanguage }, ...languages]}
            onChange={(v) => set("language", v === ANY ? "" : v)}
            className="w-full"
          />
        </Field>
        <Field label={te.minVph} hint={te.minVphHint}>
          <Input type="number" min={0} step={100} value={filters.minVph ?? ""} onChange={(e) => set("minVph", e.target.value)} placeholder="5000" />
        </Field>
        <Field label={te.minMultiplier}>
          <FilterSelect
            value={filters.minMultiplier ?? ANY}
            options={[{ value: ANY, label: te.anyMultiplier }, ...MULTIPLIERS.map((m) => ({ value: m, label: t.inspirations.threshold(m) }))]}
            onChange={(v) => set("minMultiplier", v === ANY ? "" : v)}
            className="w-full"
          />
        </Field>
        <Field label={te.minViews}>
          <Input type="number" min={0} step={1000} value={filters.minViews ?? ""} onChange={(e) => set("minViews", e.target.value)} placeholder="10000" />
        </Field>
        <Field label={te.frequency} hint={te.frequencyHint}>
          <FilterSelect
            value={frequency}
            options={FREQUENCIES.map((f) => ({ value: f, label: ta.frequencies[f] }))}
            onChange={(v) => setFrequency(v as AlertFrequency)}
            className="w-full"
          />
        </Field>
        <Field label={te.discord} hint={te.discordHint} className="sm:col-span-2">
          <div className="flex gap-2">
            <Input
              type="url"
              value={webhook}
              onChange={(e) => {
                setWebhook(e.target.value);
                setRemoveWebhook(false);
              }}
              placeholder={alert?.discordWebhook && !removeWebhook ? te.discordKeep(alert.discordWebhook) : "https://discord.com/api/webhooks/…"}
            />
            {alert?.discordWebhook && !removeWebhook && !webhook && (
              <Button type="button" variant="outline" onClick={() => setRemoveWebhook(true)}>
                {te.discordRemove}
              </Button>
            )}
          </div>
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">{te.preview}</span>
          <span className="text-xs text-muted-foreground">
            {previewLoading ? <Loader2 className="size-3.5 animate-spin" /> : preview?.narrow ? te.previewCount(preview.total) : ""}
          </span>
        </div>
        {!previewLoading && preview && !preview.narrow ? (
          <p className="py-3 text-center text-xs text-muted-foreground">{te.tooBroad}</p>
        ) : !previewLoading && preview?.items.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">{te.previewEmpty}</p>
        ) : (
          <div className="flex max-h-72 flex-col overflow-y-auto">
            {(preview?.items ?? []).slice(0, 6).map((video) => (
              <AlertVideoRow key={video.id} video={video} vphScale={vphScale} />
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          {alert ? t.common.save : te.create}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("grid content-start gap-1.5", className)}>
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
