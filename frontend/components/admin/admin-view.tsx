"use client";

import * as React from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Eye,
  FlaskConical,
  LayoutDashboard,
  Search,
  SearchX,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/components/i18n-provider";
import type { Messages } from "@/lib/i18n";

type AdminMessages = Messages["admin"];

/* ------------------------------------------------------------------ helpers */

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`);
  return res.json();
}


function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** Strings and formatters of the admin, in the interface language. */
function useAdminI18n() {
  const { t, compact, date } = useI18n();
  const fmtDate = (value: string | null | undefined) => {
    if (!value) return "—";
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : date(d, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  return { t, ta: t.admin, common: t.common, compact, fmtDate };
}

function useAdminData<T>(url: string) {
  // Keyed by url so a new query shows the loader instead of the previous result
  const [state, setState] = React.useState<{ url: string; data: T | null; error: string | null }>({ url, data: null, error: null });
  React.useEffect(() => {
    let cancelled = false;
    fetchJson<T>(url)
      .then((data) => !cancelled && setState({ url, data, error: null }))
      .catch((err: Error) => !cancelled && setState({ url, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [url]);
  const current = state.url === url;
  return { data: current ? state.data : null, error: current ? state.error : null };
}

/** Page number that goes back to 1 whenever `resetKey` (search, filters) changes. */
function usePage(resetKey: string) {
  const [state, setState] = React.useState({ key: resetKey, page: 1 });
  const page = state.key === resetKey ? state.page : 1;
  const setPage = (p: number) => setState({ key: resetKey, page: p });
  return [page, setPage] as const;
}

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function qs(params: Record<string, string | number | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
}



function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}

function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const { ta, compact } = useAdminI18n();
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {ta.results(compact(total), total > 1)} · {ta.page(page, pages)}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={ta.previousPage}>
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={ta.nextPage}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

function Failed({ error }: { error: string }) {
  const { ta } = useAdminI18n();
  return <EmptyState title={ta.loadFailed} description={error} />;
}

function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              {head.map((h, i) => (
                <th key={i} className="px-3 py-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className ?? ""}`}>{children}</td>;
}

function Avatar({ src, alt }: { src?: string | null; alt: string }) {
  if (!src) return <div className="size-7 shrink-0 rounded-full bg-muted" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="size-7 shrink-0 rounded-full object-cover" loading="lazy" />;
}

function ChannelChip({ id, name, avatar }: { id: string; name?: string | null; avatar?: string | null }) {
  return (
    <a
      href={`https://www.youtube.com/channel/${id}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-1.5 py-0.5 text-xs hover:bg-muted"
    >
      <Avatar src={avatar} alt="" />
      <span className="truncate">{name || id}</span>
    </a>
  );
}

/* ------------------------------------------------------------------ overview */

interface Overview {
  counts: Record<string, number>;
  recentUsers: { id: string; email: string; name: string; role: string; createdAt: string }[];
  recentScans: { id: number; startedAt: string; finishedAt: string | null; status: string }[];
  posthogUrl: string;
}

function counters(ta: AdminMessages): { key: string; label: string; sub?: (c: Record<string, number>) => string }[] {
  const c = ta.counters;
  return [
    { key: "users", label: c.users, sub: (n) => c.usersSub(n.newUsers7d) },
    { key: "onboardedUsers", label: c.onboardedUsers, sub: (n) => c.onboardedUsersSub(n.onboardings, n.onboardingsOk) },
    { key: "folders", label: c.folders, sub: (n) => c.foldersSub(n.folderItems) },
    { key: "trackedChannels", label: c.trackedChannels },
    { key: "abTests", label: c.abTests, sub: () => c.abTestsSub },
    { key: "channels", label: c.channels },
    { key: "videos", label: c.videos },
    { key: "alerts", label: c.alerts },
  ];
}

function OverviewTab() {
  const { ta, compact, fmtDate } = useAdminI18n();
  const { data, error } = useAdminData<Overview>("/api/admin/overview");
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counters(ta).map((c) => (
          <Card key={c.key} className="gap-1 p-4">
            <span className="text-xs text-muted-foreground">{c.label}</span>
            <span className="text-2xl font-semibold tabular-nums">{compact(data.counts[c.key])}</span>
            {c.sub && <span className="text-xs text-muted-foreground">{c.sub(data.counts)}</span>}
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{ta.overview.recentUsers}</h3>
          <Table head={[ta.overview.user, ta.overview.role, ta.overview.signedUp]}>
            {data.recentUsers.map((u) => (
              <tr key={u.id}>
                <Td>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </Td>
                <Td>{u.role === "admin" ? <Badge>admin</Badge> : <Badge variant="outline">{u.role}</Badge>}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(u.createdAt)}</Td>
              </tr>
            ))}
          </Table>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{ta.overview.recentScans}</h3>
          <Table head={["#", ta.overview.status, ta.overview.start, ta.overview.end]}>
            {data.recentScans.map((s) => (
              <tr key={s.id}>
                <Td className="text-muted-foreground">{s.id}</Td>
                <Td>
                  <Badge variant={s.status === "failed" ? "destructive" : "secondary"}>{s.status}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(s.startedAt)}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(s.finishedAt)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>

      <Card className="flex-row items-center justify-between gap-4 p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{ta.overview.analyticsTitle}</span>
          <span className="text-xs text-muted-foreground">{ta.overview.analyticsDescription}</span>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={data.posthogUrl} target="_blank" rel="noreferrer" />}>
          {ta.overview.openPosthog} <ExternalLink />
        </Button>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ users */

interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  plan: string;
  role: string;
  createdAt: string;
  channelId: string | null;
  channelName: string | null;
  channelAvatar: string | null;
  channelSubscribers: number | null;
  competitors: { id: string; name: string | null; avatar: string | null }[];
  folders: number;
  folderItems: number;
  onboardings: number;
}

function UsersTab() {
  const { ta, fmtDate } = useAdminI18n();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data, error } = useAdminData<{ users: AdminUser[] }>(`/api/admin/users${qs({ q })}`);
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={search} onChange={setSearch} placeholder={ta.users.search} />
      {error ? (
        <Failed error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <Table head={[ta.overview.user, ta.overview.role, ta.users.ownChannel, ta.users.competitors, ta.users.folders, ta.users.analyses, ta.overview.signedUp]}>
          {data.users.map((u) => (
            <tr key={u.id}>
              <Td>
                <div className="flex items-center gap-2">
                  <Avatar src={u.avatar} alt="" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </div>
              </Td>
              <Td>
                {u.role === "admin" ? <Badge>admin</Badge> : <Badge variant="outline">{u.role}</Badge>}
                <div className="mt-1 text-xs text-muted-foreground">{u.plan}</div>
              </Td>
              <Td>
                {u.channelId ? (
                  <ChannelChip id={u.channelId} name={u.channelName} avatar={u.channelAvatar} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Td>
              <Td>
                <div className="flex max-w-[460px] flex-wrap gap-1">
                  {u.competitors.length === 0 && <span className="text-muted-foreground">—</span>}
                  {u.competitors.map((c) => (
                    <ChannelChip key={c.id} {...c} />
                  ))}
                </div>
              </Td>
              <Td className="tabular-nums">
                {u.folders} <span className="text-xs text-muted-foreground">{ta.users.items(u.folderItems)}</span>
              </Td>
              <Td className="tabular-nums">{u.onboardings}</Td>
              <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(u.createdAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ onboardings */

interface Onboarding {
  id: number;
  userId: string | null;
  email: string | null;
  name: string | null;
  inputChannel: string | null;
  niche: string | null;
  role: string | null;
  reference: { id: string; title: string; avatar: string; subscriberCount: number; archetypeLabel: string; editorialTags: string[] } | null;
  competitors: { id: string; title: string; avatar: string; subscriberCount: number; similarityScore: number; archetypeLabel: string }[];
  insights: { summary: string; reasons: Record<string, { why: string; steal: string }>; engine: string } | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

function OnboardingsTab() {
  const { ta } = useAdminI18n();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [page, setPage] = usePage(q);
  const { data, error } = useAdminData<{ total: number; rows: Onboarding[] }>(`/api/admin/onboardings${qs({ q, page })}`);
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={search} onChange={setSearch} placeholder={ta.onboardings.search} />
      {error ? (
        <Failed error={error} />
      ) : !data ? (
        <Loading />
      ) : data.rows.length === 0 ? (
        <EmptyState
          title={ta.onboardings.emptyTitle}
          description={ta.onboardings.emptyDescription}
        />
      ) : (
        <>
          <Pager page={page} size={25} total={data.total} onPage={setPage} />
          {data.rows.map((o) => (
            <OnboardingCard key={o.id} o={o} />
          ))}
        </>
      )}
    </div>
  );
}

function OnboardingCard({ o }: { o: Onboarding }) {
  const { ta, common, compact, fmtDate } = useAdminI18n();
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {o.reference ? <ChannelChip id={o.reference.id} name={o.reference.title} avatar={o.reference.avatar} /> : <span className="text-sm">{o.inputChannel || o.niche || "—"}</span>}
          {o.reference && (
            <span className="text-xs text-muted-foreground">
              {common.subscribers(compact(o.reference.subscriberCount))} · {o.reference.archetypeLabel}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {o.error ? <Badge variant="destructive">{ta.onboardings.failed}</Badge> : <Badge variant="secondary">{ta.onboardings.ai(o.insights?.engine ?? "—")}</Badge>}
          {o.role && <Badge variant="outline">{o.role}</Badge>}
          {o.niche && <Badge variant="outline">{ta.onboardings.niche(o.niche)}</Badge>}
          <span>{o.email ?? ta.onboardings.anonymous}</span>
          <span>·</span>
          <span>{fmtDate(o.createdAt)}</span>
          {o.durationMs != null && <span>· {(o.durationMs / 1000).toFixed(0)} s</span>}
        </div>
      </div>
      {o.error && <p className="text-sm text-destructive">{o.error}</p>}
      {o.insights?.summary && (
        <p className="flex gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {o.insights.summary}
        </p>
      )}
      {o.competitors.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">{ta.onboardings.competitorsFound(o.competitors.length)}</summary>
          <div className="mt-2 flex flex-col divide-y">
            {o.competitors.map((c) => {
              const reason = o.insights?.reasons?.[c.id];
              return (
                <div key={c.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex w-64 shrink-0 items-center gap-2">
                    <ChannelChip id={c.id} name={c.title} avatar={c.avatar} />
                    <Badge variant="outline">{Math.round(c.similarityScore)} %</Badge>
                  </div>
                  <div className="text-sm">
                    {reason?.why && <p>{reason.why}</p>}
                    {reason?.steal && <p className="text-muted-foreground">{ta.onboardings.steal(reason.steal)}</p>}
                    {!reason && <p className="text-muted-foreground">{common.subscribers(compact(c.subscriberCount))} · {c.archetypeLabel}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ folders */

interface AdminFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  email: string;
  userName: string;
  items: { type: "video" | "channel"; id: string; snapshot: { title?: string; name?: string; thumbnail?: string | null; avatar?: string | null }; addedAt: string }[];
}

function FoldersTab() {
  const { ta, fmtDate } = useAdminI18n();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data, error } = useAdminData<{ folders: AdminFolder[] }>(`/api/admin/folders${qs({ q })}`);
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={search} onChange={setSearch} placeholder={ta.folders.search} />
      {error ? (
        <Failed error={error} />
      ) : !data ? (
        <Loading />
      ) : data.folders.length === 0 ? (
        <EmptyState title={ta.folders.emptyTitle} description={ta.folders.emptyDescription} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {data.folders.map((f) => (
            <Card key={f.id} className="gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.userName} · {f.email}
                  </div>
                </div>
                <span className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(f.updatedAt)}</span>
              </div>
              {f.items.length === 0 ? (
                <span className="text-sm text-muted-foreground">{ta.folders.emptyFolder}</span>
              ) : (
                <div className="flex flex-col divide-y">
                  {f.items.map((i) => (
                    <div key={`${i.type}-${i.id}`} className="flex items-center gap-2 py-1.5 text-sm">
                      {i.snapshot?.thumbnail || i.snapshot?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={i.snapshot.thumbnail || i.snapshot.avatar || undefined}
                          alt=""
                          className={i.type === "video" ? "h-8 w-14 rounded object-cover" : "size-8 rounded-full object-cover"}
                        />
                      ) : null}
                      <Badge variant="outline">{i.type === "video" ? ta.folders.video : ta.folders.channel}</Badge>
                      <a
                        href={i.type === "video" ? `https://www.youtube.com/watch?v=${i.id}` : `https://www.youtube.com/channel/${i.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline"
                      >
                        {i.snapshot?.title || i.snapshot?.name || i.id}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ channels */

interface TrackedData {
  tracked: {
    id: string;
    channelId: string;
    name: string;
    handle: string | null;
    avatar: string | null;
    subscribers: number | null;
    videoCount: number | null;
    baselineViews: number | null;
    folderName: string | null;
    tags: string[] | null;
    lastCheckedAt: string | null;
    addedAt: string;
  }[];
  picked: { channelId: string; name: string | null; avatar: string | null; subscribers: number | null; asOwn: number; asCompetitor: number }[];
}

function ChannelsTab() {
  const { ta, compact, fmtDate } = useAdminI18n();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const { data, error } = useAdminData<TrackedData>(`/api/admin/tracked${qs({ q })}`);
  return (
    <div className="flex flex-col gap-3">
      <SearchBox value={search} onChange={setSearch} placeholder={ta.channels.search} />
      {error ? (
        <Failed error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <h3 className="text-sm font-medium">{ta.channels.picked(data.picked.length)}</h3>
          <Table head={[ta.channels.channel, ta.channels.subscribers, ta.channels.asOwn, ta.channels.asCompetitor]}>
            {data.picked.map((p) => (
              <tr key={p.channelId}>
                <Td>
                  <ChannelChip id={p.channelId} name={p.name} avatar={p.avatar} />
                </Td>
                <Td className="tabular-nums">{compact(p.subscribers)}</Td>
                <Td className="tabular-nums">{p.asOwn}</Td>
                <Td className="tabular-nums">{p.asCompetitor}</Td>
              </tr>
            ))}
          </Table>
          <h3 className="mt-3 text-sm font-medium">{ta.channels.tracked(data.tracked.length)}</h3>
          <Table head={[ta.channels.channel, ta.channels.subscribers, ta.channels.videos, ta.channels.baselineViews, ta.channels.folder, ta.channels.tags, ta.channels.lastChecked, ta.channels.added]}>
            {data.tracked.map((t) => (
              <tr key={t.id}>
                <Td>
                  <ChannelChip id={t.channelId} name={t.name} avatar={t.avatar} />
                </Td>
                <Td className="tabular-nums">{compact(t.subscribers)}</Td>
                <Td className="tabular-nums">{compact(t.videoCount)}</Td>
                <Td className="tabular-nums">{compact(t.baselineViews)}</Td>
                <Td>{t.folderName ?? "—"}</Td>
                <Td>
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {(t.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(t.lastCheckedAt)}</Td>
                <Td className="whitespace-nowrap text-muted-foreground">{fmtDate(t.addedAt)}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ A/B tests */

interface AbTest {
  videoId: string;
  kind: "title" | "thumbnail";
  variants: number;
  lastChange: string;
  title: string | null;
  thumbnail: string | null;
  views: number | null;
  multiplier: number | null;
  publishedAt: string | null;
  channelName: string | null;
  channelId: string | null;
  history: { value: string; setAt: string | null; firstSeenAt: string; lastSeenAt: string; image: string | null }[];
}

function AbTestsTab() {
  const { ta, common, compact, fmtDate } = useAdminI18n();
  const [search, setSearch] = React.useState("");
  const [kind, setKind] = React.useState<"" | "title" | "thumbnail">("");
  const q = useDebounced(search);
  const [page, setPage] = usePage(`${q}|${kind}`);
  const { data, error } = useAdminData<{ total: number; tests: AbTest[] }>(`/api/admin/ab-tests${qs({ q, kind, page })}`);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {ta.abTests.intro} <code>video_variants</code>).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder={ta.abTests.search} />
        <div className="flex gap-1">
          {([["", ta.abTests.all], ["title", ta.abTests.titles], ["thumbnail", ta.abTests.thumbnails]] as const).map(([value, label]) => (
            <Button key={value} size="sm" variant={kind === value ? "default" : "outline"} onClick={() => setKind(value)}>
              {label}
            </Button>
          ))}
        </div>
      </div>
      {error ? (
        <Failed error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <Pager page={page} size={30} total={data.total} onPage={setPage} />
          {data.tests.map((t) => (
            <Card key={`${t.videoId}-${t.kind}`} className="gap-3 p-4">
              <div className="flex gap-3">
                {t.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.thumbnail} alt="" className="h-16 w-28 shrink-0 rounded object-cover" loading="lazy" />
                )}
                <div className="min-w-0 flex-1">
                  <a href={`https://www.youtube.com/watch?v=${t.videoId}`} target="_blank" rel="noreferrer" className="line-clamp-2 font-medium hover:underline">
                    {t.title || t.videoId}
                  </a>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{t.kind === "title" ? ta.abTests.title : ta.abTests.thumbnail} · {ta.abTests.versions(t.variants)}</Badge>
                    {t.channelName && <span>{t.channelName}</span>}
                    {t.views != null && <span>· {common.views(compact(t.views))}</span>}
                    {t.multiplier != null && <span>· x{Number(t.multiplier).toFixed(1)}</span>}
                    <span>· {ta.abTests.lastChange(fmtDate(t.lastChange))}</span>
                  </div>
                </div>
              </div>
              {t.kind === "thumbnail" ? (
                <div className="flex flex-wrap gap-3">
                  {t.history.map((h, i) => (
                    <div key={i} className="flex w-48 flex-col gap-1">
                      {h.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={h.image} alt={ta.abTests.thumbnailAlt(i + 1)} className="aspect-video w-full rounded-md border object-cover" loading="lazy" />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed px-2 text-center text-xs text-muted-foreground">
                          {ta.abTests.notSaved}
                        </div>
                      )}
                      <span className="text-xs font-medium">{ta.abTests.version(i + 1)}</span>
                      <span className="text-xs text-muted-foreground">
                        {ta.abTests.seenBetween(fmtDate(h.firstSeenAt), fmtDate(h.lastSeenAt))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <ol className="flex flex-col gap-1 border-l pl-3 text-sm">
                  {t.history.map((h, i) => (
                    <li key={i} className="flex flex-col sm:flex-row sm:gap-3">
                      <span className="w-40 shrink-0 text-xs text-muted-foreground">{fmtDate(h.setAt ?? h.firstSeenAt)}</span>
                      <span>{h.value}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ PostgreSQL */

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function PostgresTab() {
  const { ta, compact } = useAdminI18n();
  const { data } = useAdminData<{ tables: { name: string; rows: number; bytes: number }[] }>("/api/admin/tables");
  const [table, setTable] = React.useState<string | null>(null);
  if (!data) return <Loading />;
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <Card className="h-fit shrink-0 gap-0 p-1 lg:w-64">
        {data.tables.map((t) => (
          <button
            key={t.name}
            onClick={() => setTable(t.name)}
            className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted ${table === t.name ? "bg-muted font-medium" : ""}`}
          >
            <span className="truncate">{t.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{compact(t.rows)}</span>
          </button>
        ))}
      </Card>
      <div className="min-w-0 flex-1">
        {table ? <TableRows key={table} name={table} /> : <EmptyState title={ta.postgres.pickTitle} description={ta.postgres.pickDescription(data.tables.length)} />}
      </div>
    </div>
  );
}

function TableRows({ name }: { name: string }) {
  const { ta } = useAdminI18n();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search);
  const [page, setPage] = usePage(q);
  const { data, error } = useAdminData<{ columns: { name: string; type: string }[]; total: number; rows: Record<string, unknown>[] }>(
    `/api/admin/tables/${encodeURIComponent(name)}${qs({ q, page })}`
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchBox value={search} onChange={setSearch} placeholder={ta.postgres.search(name)} />
        {data && <Pager page={page} size={50} total={data.total} onPage={setPage} />}
      </div>
      {error ? (
        <Failed error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <Table head={data.columns.map((c) => c.name)}>
          {data.rows.map((row, i) => (
            <tr key={i}>
              {data.columns.map((c) => (
                <Td key={c.name}>
                  <div className="max-w-[320px] truncate font-mono text-xs" title={cellText(row[c.name])}>
                    {cellText(row[c.name])}
                  </div>
                </Td>
              ))}
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

const TABS: { value: string; label: keyof AdminMessages["tabs"]; icon: React.ComponentType; Content: React.ComponentType }[] = [
  { value: "overview", label: "overview", icon: LayoutDashboard, Content: OverviewTab },
  { value: "users", label: "users", icon: Users, Content: UsersTab },
  { value: "onboardings", label: "onboardings", icon: Sparkles, Content: OnboardingsTab },
  { value: "folders", label: "folders", icon: Bookmark, Content: FoldersTab },
  { value: "channels", label: "channels", icon: Eye, Content: ChannelsTab },
  { value: "ab-tests", label: "abTests", icon: FlaskConical, Content: AbTestsTab },
  { value: "postgres", label: "postgres", icon: Database, Content: PostgresTab },
];

/** /admin: every user, onboarding, AI result and database of the site. */
export function AdminView({ adminEmail }: { adminEmail: string }) {
  const { ta } = useAdminI18n();
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{ta.title}</h2>
          <p className="text-sm text-muted-foreground">{ta.description(adminEmail)}</p>
        </div>
        <Tabs defaultValue="overview" className="gap-5">
          <TabsList className="w-full flex-wrap group-data-horizontal/tabs:h-auto justify-start p-1 sm:w-fit">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-none px-3">
                <t.icon />
                {ta.tabs[t.label]}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <t.Content />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
