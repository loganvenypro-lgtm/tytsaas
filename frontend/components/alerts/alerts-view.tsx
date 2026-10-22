"use client";

import * as React from "react";
import { BellOff, BellRing, CheckCheck, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/explorer/explorer-ui";
import { localize, useFilterSpec } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";
import {
  ALERTS_CHANGED_EVENT,
  alertFeed,
  deleteAlert,
  listAlerts,
  markAlertsRead,
  previewAlert,
  testAlertDiscord,
  updateAlert,
  type AlertInput,
  type AlertMatch,
  type AlertRule,
} from "@/lib/alerts";
import type { OutlierVideo } from "@/components/top-videos/outlier-card";
import { cn } from "@/lib/utils";
import { AlertEditor } from "./alert-editor";
import { AlertVideoRow } from "./alert-video-row";

/** Ready-made alerts offered when the user has none yet. */
const TEMPLATES: { key: "competitors" | "inspirations" | "viral"; input: Omit<AlertInput, "name"> }[] = [
  { key: "competitors", input: { source: "competitors", frequency: "instant", filters: { minMultiplier: "2" } } },
  { key: "inspirations", input: { source: "inspirations", frequency: "daily", filters: { minMultiplier: "3" } } },
  { key: "viral", input: { source: "all", frequency: "daily", filters: { minVph: "5000", minMultiplier: "5" } } },
];

/**
 * Alerts: the user's rules on the right, what they caught on the left (unread
 * first). Selecting a rule shows its criteria, its matches, and what it would
 * catch right now when it has none yet.
 */
export function AlertsView() {
  const { t } = useI18n();
  const ta = t.alerts;

  const [alerts, setAlerts] = React.useState<AlertRule[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"unread" | "all">("unread");
  const [editing, setEditing] = React.useState<{ alert: AlertRule | null; initial?: Partial<AlertInput> } | null>(null);
  const [deleting, setDeleting] = React.useState<AlertRule | null>(null);

  const loadAlerts = React.useCallback(() => {
    listAlerts()
      .then((list) => {
        setAlerts(list);
        setLoadError(null);
      })
      .catch((err: Error) => setLoadError(err.message));
  }, []);
  React.useEffect(() => {
    loadAlerts();
    window.addEventListener(ALERTS_CHANGED_EVENT, loadAlerts);
    return () => window.removeEventListener(ALERTS_CHANGED_EVENT, loadAlerts);
  }, [loadAlerts]);

  const current = alerts?.find((a) => a.id === selected) ?? null;
  const unreadTotal = (alerts ?? []).reduce((sum, a) => sum + a.unread, 0);

  // The feed: matches of every alert or of the selected one
  const feedKey = `${current?.id ?? ""}|${tab}|${alerts?.map((a) => `${a.id}:${a.unread}:${a.matches}`).join(",")}`;
  const [feed, setFeed] = React.useState<{ key: string; items: AlertMatch[] } | null>(null);
  React.useEffect(() => {
    if (!alerts) return;
    let cancelled = false;
    const [alertId, which] = feedKey.split("|");
    alertFeed({ alertId: alertId || null, unread: which === "unread" })
      .then((items) => !cancelled && setFeed({ key: feedKey, items }))
      .catch(() => !cancelled && setFeed({ key: feedKey, items: [] }));
    return () => {
      cancelled = true;
    };
  }, [feedKey, alerts]);
  const feedItems = feed?.items ?? [];
  const feedLoading = feed?.key !== feedKey;

  // A selected alert without matches yet: what it would catch now
  const [preview, setPreview] = React.useState<{ id: string; items: OutlierVideo[] } | null>(null);
  const needsPreview = current != null && !feedLoading && feedItems.length === 0;
  React.useEffect(() => {
    if (!needsPreview || !current) return;
    let cancelled = false;
    previewAlert(current)
      .then((data) => !cancelled && setPreview({ id: current.id, items: data.items }))
      .catch(() => !cancelled && setPreview({ id: current.id, items: [] }));
    return () => {
      cancelled = true;
    };
  }, [needsPreview, current]);
  const previewItems = needsPreview && preview?.id === current?.id ? preview.items : null;

  const shown = previewItems ?? feedItems;
  const vphScale = Math.max(1, ...shown.map((v) => v.viewsPerHour ?? 0));

  const readAll = async () => {
    try {
      await markAlertsRead(current?.id);
    } catch (err) {
      toast.add({ type: "error", title: ta.genericError, description: err instanceof Error ? err.message : undefined });
    }
  };

  const toggleEnabled = async (alert: AlertRule) => {
    try {
      await updateAlert(alert.id, { enabled: !alert.enabled });
    } catch (err) {
      toast.add({ type: "error", title: ta.genericError, description: err instanceof Error ? err.message : undefined });
    }
  };

  const testDiscord = async (alert: AlertRule) => {
    try {
      await testAlertDiscord(alert.id);
      toast.add({ type: "success", title: ta.testSent });
    } catch (err) {
      toast.add({ type: "error", title: ta.testFailed, description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{ta.title}</h2>
            <p className="text-sm text-muted-foreground">{ta.description}</p>
          </div>
          <Button onClick={() => setEditing({ alert: null })} disabled={!alerts}>
            <Plus className="size-4" />
            {ta.create}
          </Button>
        </div>

        {loadError ? (
          <EmptyState title={ta.loadError} description={t.common.loadErrorHint}>
            <Button variant="outline" size="sm" onClick={loadAlerts}>
              {t.common.retry}
            </Button>
          </EmptyState>
        ) : !alerts ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Skeleton className="h-[480px] rounded-xl" />
            <Skeleton className="h-[320px] rounded-xl" />
          </div>
        ) : alerts.length === 0 ? (
          <Card className="items-center gap-4 p-8 text-center">
            <BellRing className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">{ta.emptyTitle}</span>
              <span className="max-w-lg text-sm text-muted-foreground">{ta.emptyHint}</span>
            </div>
            <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => setEditing({ alert: null, initial: { ...template.input, name: ta.templates[template.key].name } })}
                  className="flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="text-sm font-medium">{ta.templates[template.key].name}</span>
                  <span className="text-xs text-muted-foreground">{ta.templates[template.key].description}</span>
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setEditing({ alert: null })}>
              <Plus className="size-4" />
              {ta.createBlank}
            </Button>
          </Card>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="order-2 gap-3 p-4 lg:order-1">
              {current ? <AlertSummary alert={current} /> : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {previewItems ? ta.previewTitle(current!.name) : current ? ta.matchesOf(current.name) : ta.allMatches}
                </span>
                <div className="flex items-center gap-2">
                  {!previewItems && (
                    <Tabs value={tab} onValueChange={(v) => setTab(v as "unread" | "all")}>
                      <TabsList>
                        <TabsTrigger value="unread">{ta.tabs.unread(current ? current.unread : unreadTotal)}</TabsTrigger>
                        <TabsTrigger value="all">{ta.tabs.all}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                  {(current ? current.unread : unreadTotal) > 0 && (
                    <Button variant="ghost" size="sm" onClick={readAll}>
                      <CheckCheck className="size-4" />
                      {ta.markRead}
                    </Button>
                  )}
                </div>
              </div>
              {previewItems && <p className="text-xs text-muted-foreground">{ta.previewHint}</p>}

              {feedLoading || (needsPreview && !previewItems) ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              ) : shown.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {current ? ta.noMatchYet : tab === "unread" ? ta.allRead : ta.noMatches}
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {shown.map((video) => {
                    const match = previewItems ? null : (video as AlertMatch);
                    return (
                      <AlertVideoRow
                        key={`${match?.alert.id ?? ""}-${video.id}`}
                        video={video}
                        vphScale={vphScale}
                        alertName={!current ? match?.alert.name : undefined}
                        unread={match?.unread}
                      />
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="order-1 gap-3 p-4 lg:order-2">
              <span className="text-sm font-medium">{ta.myAlerts}</span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                    !current && "border-primary/40 bg-primary/5",
                  )}
                >
                  <span className="font-medium">{ta.allAlerts}</span>
                  {unreadTotal > 0 && <Badge>{unreadTotal}</Badge>}
                </button>
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border pr-1 transition-colors hover:bg-muted/60",
                      current?.id === alert.id && "border-primary/40 bg-primary/5",
                      !alert.enabled && "opacity-60",
                    )}
                  >
                    <button type="button" onClick={() => setSelected(alert.id)} className="flex min-w-0 flex-1 flex-col px-3 py-2 text-left">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{alert.name}</span>
                        {alert.unread > 0 && <Badge className="shrink-0">{alert.unread}</Badge>}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[ta.sources[alert.source], ta.frequencies[alert.frequency], alert.discordWebhook && "Discord", !alert.enabled && ta.paused]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                    <IconButton label={alert.enabled ? ta.pause : ta.resume} onClick={() => toggleEnabled(alert)}>
                      {alert.enabled ? <BellRing /> : <BellOff />}
                    </IconButton>
                    {alert.discordWebhook && (
                      <IconButton label={ta.testDiscord} onClick={() => testDiscord(alert)}>
                        <Send />
                      </IconButton>
                    )}
                    <IconButton label={ta.edit} onClick={() => setEditing({ alert })}>
                      <Pencil />
                    </IconButton>
                    <IconButton label={ta.delete} onClick={() => setDeleting(alert)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                ))}
              </div>
              {/* The header has the same button; only repeated next to the list on wide screens */}
              <Button className="max-lg:hidden" onClick={() => setEditing({ alert: null })}>
                <Plus className="size-4" />
                {ta.create}
              </Button>
              <p className="text-[11px] text-muted-foreground">{ta.footnote}</p>
            </Card>
          </div>
        )}
      </div>

      <AlertEditor
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
        alert={editing?.alert ?? null}
        initial={editing?.initial}
        onSaved={(alert) => {
          setEditing(null);
          setSelected(alert.id);
          toast.add({ type: "success", title: ta.saved(alert.name) });
        }}
      />
      <DeleteDialog alert={deleting} onClose={() => setDeleting(null)} onDeleted={(id) => selected === id && setSelected(null)} />
    </div>
  );
}

/** The selected alert's criteria, like the rule editor shows them. */
function AlertSummary({ alert }: { alert: AlertRule }) {
  const { t, locale, compact } = useI18n();
  const ta = t.alerts;
  const te = ta.editor;
  const { spec } = useFilterSpec("videos");
  const label = (key: string, value: string | undefined) => {
    if (!value) return null;
    const option = spec?.filters.find((f) => f.key === key)?.options?.find((o) => String(o.value) === value);
    return option ? localize(option.label, locale) : value;
  };
  const f = alert.filters;
  const items = [
    [te.keywords, f.q ?? "—"],
    [te.source, ta.sources[alert.source]],
    [te.niche, [label("niche", f.niche), label("subNiche", f.subNiche)].filter(Boolean).join(" › ") || te.anyNiche],
    [te.format, t.inspirations.formats[(f.format as "long" | "short") ?? "all"] ?? t.inspirations.formats.all],
    [te.language, label("language", f.language) ?? te.anyLanguage],
    [te.minVph, f.minVph ? compact(Number(f.minVph)) : "—"],
    [te.minMultiplier, f.minMultiplier ? `${f.minMultiplier}x` : "—"],
    [te.frequency, ta.frequencies[alert.frequency]],
  ];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-4">
      {items.map(([name, value]) => (
        <div key={name} className="flex min-w-0 flex-col">
          <span className="text-[11px] text-muted-foreground">{name}</span>
          <span className="truncate text-sm font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={onClick} className="text-muted-foreground">
      {children}
    </Button>
  );
}

function DeleteDialog({ alert, onClose, onDeleted }: { alert: AlertRule | null; onClose: () => void; onDeleted: (id: string) => void }) {
  const { t } = useI18n();
  const ta = t.alerts;
  const [pending, setPending] = React.useState(false);
  const confirm = async () => {
    if (!alert) return;
    setPending(true);
    try {
      await deleteAlert(alert.id);
      onDeleted(alert.id);
      onClose();
    } catch (err) {
      toast.add({ type: "error", title: ta.genericError, description: err instanceof Error ? err.message : undefined });
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog open={alert != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{alert ? ta.deleteTitle(alert.name) : ""}</DialogTitle>
          <DialogDescription>{ta.deleteDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {ta.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
