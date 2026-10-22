"use client";

import * as React from "react";
import {
  Check,
  Clapperboard,
  Copy,
  FileText,
  Image as ImageIcon,
  ListVideo,
  Loader2,
  Megaphone,
  MonitorPlay,
  Pin,
  RefreshCw,
  Repeat,
  Sparkles,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { fetchReviveReport, type MyVideo, type ReviveAction, type ReviveReport } from "@/lib/my-channel";
import { cn } from "@/lib/utils";
import { useErrorText } from "./my-channel-shell";

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  title: Type,
  thumbnail: ImageIcon,
  short: Clapperboard,
  pin: Pin,
  playlist: ListVideo,
  endscreen: MonitorPlay,
  description: FileText,
  community: Megaphone,
  update: Repeat,
};

const PRIORITY_CLASSES: Record<ReviveAction["priority"], string> = {
  high: "bg-red-500/10 text-red-700 dark:text-red-300",
  medium: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
};

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? t.myChannel.report.copied : t.myChannel.report.copy}
      title={copied ? t.myChannel.report.copied : t.myChannel.report.copy}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function ActionItem({ action }: { action: ReviveAction }) {
  const { t } = useI18n();
  const tr = t.myChannel.report;
  const Icon = ACTION_ICONS[action.type] ?? Sparkles;
  return (
    <li className="flex gap-3 rounded-lg border p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium">{action.title}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
            {tr.types[action.type] ?? action.type}
          </Badge>
          <Badge variant="secondary" className={cn("h-5 px-1.5 text-[10px]", PRIORITY_CLASSES[action.priority])}>
            {tr.priority[action.priority]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{action.detail}</p>
        {action.examples.length > 0 && (
          <ul className="flex flex-col gap-1">
            {action.examples.map((example) => (
              <li key={example} className="flex items-center gap-1 rounded-md bg-muted/60 py-1 pr-1 pl-2.5 text-sm">
                <span className="flex-1">{example}</span>
                <CopyButton text={example} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Traffic({ traffic }: { traffic: NonNullable<ReviveReport["traffic"]> }) {
  const { t, compact } = useI18n();
  const tr = t.myChannel.report;
  const total = traffic.sources.reduce((sum, s) => sum + (s.views ?? 0), 0);
  if (!total) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">{tr.traffic}</span>
        {traffic.sources.slice(0, 6).map((s) => (
          <div key={s.source} className="flex flex-col gap-1">
            <div className="flex justify-between gap-2 text-xs">
              <span>{tr.sources[s.source] ?? s.source}</span>
              <span className="tabular-nums text-muted-foreground">{t.common.percent(Math.round(((s.views ?? 0) / total) * 100))}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${((s.views ?? 0) / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {traffic.searchTerms.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{tr.searchTerms}</span>
          {traffic.searchTerms.slice(0, 8).map((s) => (
            <div key={s.term} className="flex justify-between gap-2 text-xs">
              <span className="truncate">{s.term}</span>
              <span className="tabular-nums text-muted-foreground">{compact(s.views ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The AI's plan to revive one of the user's videos; saved by the backend, so reopening it is instant. */
export function ReportDialog({ video, onOpenChange }: { video: MyVideo | null; onOpenChange: (open: boolean) => void }) {
  const { t, locale, ago } = useI18n();
  const tr = t.myChannel.report;
  const errorText = useErrorText();
  const [state, setState] = React.useState<{
    videoId: string;
    report?: ReviveReport;
    createdAt?: string;
    error?: string;
    loading: boolean;
  } | null>(null);

  const request = (videoId: string, refresh: boolean) =>
    fetchReviveReport(videoId, locale, refresh)
      .then(({ report, createdAt }) => setState({ videoId, report, createdAt, loading: false }))
      .catch((err) => setState({ videoId, error: errorText(err) ?? tr.failed, loading: false }));

  // Retry and "new report": keep the current report on screen while the next one comes
  const load = (videoId: string, refresh: boolean) => {
    setState((prev) => ({ ...(prev?.videoId === videoId ? prev : {}), videoId, error: undefined, loading: true }));
    request(videoId, refresh);
  };

  const videoId = video?.id;
  // Opening a video shows the loader until its report is there (state is for another video until then)
  React.useEffect(() => {
    if (videoId) request(videoId, false);
    // The report is asked for when a video is opened, not when the helpers change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  const current = state?.videoId === videoId ? state : null;
  const report = current?.report;

  return (
    <Dialog open={video != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {tr.title}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{video?.title}</DialogDescription>
        </DialogHeader>

        {!current || (current.loading && !report) ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {tr.loading}
            </p>
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : current.error && !report ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <span className="font-medium">{tr.failed}</span>
            <span className="text-muted-foreground">{current.error}</span>
            {videoId && (
              <Button variant="outline" size="sm" onClick={() => load(videoId, true)}>
                {t.common.retry}
              </Button>
            )}
          </div>
        ) : report ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 rounded-lg bg-primary/5 p-3">
              {report.verdict && (
                <Badge variant="secondary" className="w-fit">
                  {tr.verdict[report.verdict]}
                </Badge>
              )}
              <p className="text-sm font-medium">{report.summary}</p>
            </div>
            {report.diagnosis && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">{tr.diagnosis}</span>
                <p className="text-sm">{report.diagnosis}</p>
              </div>
            )}
            {report.traffic && <Traffic traffic={report.traffic} />}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{tr.plan}</span>
              <ol className="flex flex-col gap-2">
                {report.actions.map((action, i) => (
                  <ActionItem key={i} action={action} />
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-2 border-t pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                {current.createdAt && `${tr.generated(ago(current.createdAt))} · `}
                {tr.disclaimer}
              </span>
              {videoId && (
                <Button variant="outline" size="sm" onClick={() => load(videoId, true)} disabled={current.loading}>
                  {current.loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {tr.regenerate}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
