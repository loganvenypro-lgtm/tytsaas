"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, Check, Copy, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/i18n-provider";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface McpKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

type ToolName = keyof Messages["connectClaude"]["tools"]["items"];

// Server name in the Claude Code command: a slug, unlike the brand shown in claude.ai
const SERVER_SLUG = "tytsaas";
const KEY_NAME_MAX = 80;

const noopSubscribe = () => () => {};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-stretch overflow-hidden rounded-lg border bg-muted/40 focus-within:ring-2 focus-within:ring-ring/50">
        <code className={cn("min-w-0 flex-1 overflow-x-auto px-3 py-2.5 text-xs whitespace-nowrap", !mono && "font-sans text-sm")}>
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={t.connectClaude.copy(label)}
          className="flex shrink-0 items-center gap-1.5 border-l px-3 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:bg-background focus-visible:text-foreground"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          <span className="hidden sm:inline">{copied ? t.connectClaude.copied : null}</span>
        </button>
      </div>
    </div>
  );
}

/** One step of the setup path: a numbered node on a rail, ticked once the data says it's done. */
function Step({
  n,
  done,
  last = false,
  title,
  description,
  children,
}: {
  n: number;
  done: boolean;
  last?: boolean;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4 pb-10 last:pb-0">
      {!last && (
        <span
          aria-hidden
          className={cn("absolute top-8 bottom-1 left-[13px] w-px", done ? "bg-emerald-500/50" : "bg-border")}
        />
      )}
      <span
        className={cn(
          "relative flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
          done ? "bg-emerald-600 text-white" : "border bg-background text-foreground",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-4 pt-0.5">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <p className="max-w-[60ch] text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </li>
  );
}

/** Create a personal key and connect Claude to the MCP server on /api/mcp. */
export function ClaudeConnect() {
  const { t, date, ago } = useI18n();
  const tc = t.connectClaude;
  const [keys, setKeys] = useState<McpKey[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolName>("search_outliers");
  // Empty during server render, the site's own origin once hydrated
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");

  useEffect(() => {
    request<{ keys: McpKey[] }>("/api/mcp-keys")
      .then((d) => setKeys(d.keys))
      .catch(() => {
        setKeys([]);
        setError(tc.keys.loadError);
      });
  }, [tc.keys.loadError]);

  const endpoint = `${origin}/api/mcp`;
  const keyText = newKey ?? tc.keyPlaceholder;
  const lastUsed = (keys ?? [])
    .map((k) => k.lastUsedAt)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1);
  const hasKey = (keys?.length ?? 0) > 0;
  const status = lastUsed ? tc.status.connected(ago(lastUsed)) : hasKey ? tc.status.ready : tc.status.none;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const data = await request<{ key: string; record: McpKey }>("/api/mcp-keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setNewKey(data.key);
      setKeys((prev) => [data.record, ...(prev ?? [])]);
      setName("");
    } catch (err) {
      setError((err as Error).message || tc.keys.createError);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setError(null);
    try {
      await request(`/api/mcp-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
      setKeys((prev) => (prev ?? []).filter((k) => k.id !== id));
    } catch {
      setError(tc.keys.revokeError);
    }
  };

  const tools = Object.entries(tc.tools.items) as [ToolName, (typeof tc.tools.items)[ToolName]][];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">{tc.title}</h2>
        <p className="max-w-[62ch] text-sm text-muted-foreground">{tc.description}</p>
        <p
          role="status"
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            lastUsed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          <span
            aria-hidden
            className={cn("size-1.5 rounded-full", lastUsed ? "bg-emerald-500" : hasKey ? "bg-amber-500" : "bg-muted-foreground/40")}
          />
          {keys === null ? t.common.loading : status}
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-14">
        <ol>
          <Step n={1} done={hasKey} title={tc.keys.title} description={tc.keys.description}>
            <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="mcp-key-name" className="text-xs font-normal text-muted-foreground">
                  {tc.keys.nameLabel}
                </Label>
                <Input
                  id="mcp-key-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tc.keys.namePlaceholder}
                  maxLength={KEY_NAME_MAX}
                  className="h-10"
                />
              </div>
              <Button type="submit" className="h-10 px-4 text-sm" disabled={creating}>
                {creating ? <Loader2 className="animate-spin" /> : <Plus />}
                {tc.keys.create}
              </Button>
            </form>

            {error && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}

            {newKey && (
              <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 motion-safe:animate-in motion-safe:fade-in">
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <Check className="size-4" />
                  {tc.keys.created}
                </p>
                <CopyField label={tc.keys.yourKey} value={newKey} />
              </div>
            )}

            {keys === null ? (
              <Skeleton className="h-14 w-full rounded-lg" />
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tc.keys.none}</p>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{tc.keys.active(keys.length)}</p>
                <ul className="divide-y rounded-lg border">
                  {keys.map((k) => (
                    <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{k.name}</span>
                        <code className="text-xs text-muted-foreground">{k.prefix}…</code>
                      </div>
                      <div className="flex flex-col text-xs text-muted-foreground sm:items-end">
                        <span className={cn(k.lastUsedAt && "text-foreground")}>
                          {k.lastUsedAt ? tc.keys.usedAgo(ago(k.lastUsedAt)) : tc.keys.neverUsed}
                        </span>
                        <span>{tc.keys.createdOn(date(k.createdAt, { day: "numeric", month: "short", year: "numeric" }))}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRevoke(k.id)}
                        aria-label={tc.keys.revokeLabel(k.name)}
                        title={tc.keys.revoke}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Step>

          <Step n={2} done={Boolean(lastUsed)} title={tc.add.title} description={tc.add.description}>
            <Tabs defaultValue="app" className="gap-4">
              <TabsList className="h-9! w-full sm:w-fit">
                <TabsTrigger value="app" className="px-3 text-sm">
                  {tc.add.tabApp}
                </TabsTrigger>
                <TabsTrigger value="code" className="px-3 text-sm">
                  {tc.add.tabCode}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="app" className="flex flex-col gap-4 text-sm">
                <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground marker:text-foreground">
                  {tc.add.appSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                  <CopyField label={tc.add.nameLabel} value={t.brand} mono={false} />
                  <CopyField label={tc.add.urlLabel} value={`${endpoint}?key=${keyText}`} />
                </div>
                {!newKey && <p className="text-xs text-muted-foreground">{tc.add.urlHint}</p>}
              </TabsContent>
              <TabsContent value="code" className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">{tc.add.codeHint}</p>
                <CopyField
                  label={tc.add.commandLabel}
                  value={`claude mcp add --transport http ${SERVER_SLUG} ${endpoint} --header "Authorization: Bearer ${keyText}"`}
                />
                {!newKey && <p className="text-xs text-muted-foreground">{tc.add.urlHint}</p>}
              </TabsContent>
            </Tabs>
          </Step>

          <Step n={3} done={Boolean(lastUsed)} last title={tc.ask.title} description={tc.ask.description(t.brand)} />
        </ol>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold tracking-tight">{tc.tools.title}</h3>
            <p className="text-sm text-muted-foreground">{tc.tools.description}</p>
          </div>

          {/* The question a creator would type, and the tool Claude reaches for */}
          <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4" aria-live="polite">
            <div key={tool} className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] text-muted-foreground">{tc.tools.you}</span>
                <p className="max-w-[90%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-sm text-background">
                  {tc.tools.items[tool].example}
                </p>
              </div>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Wrench className="size-3.5" />
                {tc.tools.calls}
                <code className="rounded-md border bg-background px-1.5 py-0.5 font-medium text-foreground">{tool}</code>
              </p>
            </div>
          </div>

          <ul className="flex flex-col">
            {tools.map(([id, item]) => {
              const active = id === tool;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setTool(id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-l-2 py-2.5 pr-2 pl-3.5 text-left transition-colors outline-none focus-visible:bg-muted",
                      active ? "border-foreground" : "border-border hover:border-muted-foreground/50",
                    )}
                  >
                    <code className={cn("text-xs font-medium", active ? "text-foreground" : "text-muted-foreground")}>{id}</code>
                    <span className={cn("text-sm", active ? "text-foreground" : "text-muted-foreground")}>{item.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
