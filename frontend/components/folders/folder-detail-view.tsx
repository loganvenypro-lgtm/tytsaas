"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Flame, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, SessionExpiredState, SessionExpiredError, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { FOLDERS_CHANGED_EVENT, type SavedItem } from "@/lib/saved-folders";
import { FolderActionsMenu } from "./folder-actions-menu";
import { removeFromFolder } from "./folders-client";

interface FolderData {
  folder: { id: string; name: string; createdAt: string; updatedAt: string };
  items: SavedItem[];
}

/** /folders/[folderId]: the videos and channels saved in one folder. */
export function FolderDetailView({ folderId }: { folderId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = React.useState<FolderData | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [filter, setFilter] = React.useState<"all" | "video" | "channel">("all");

  React.useEffect(() => {
    const load = () =>
      fetchJson<FolderData>(`/api/folders/${encodeURIComponent(folderId)}`)
        .then((json) => {
          setData(json);
          setError(null);
        })
        .catch((err: Error) => setError(err));
    load();
    window.addEventListener(FOLDERS_CHANGED_EVENT, load);
    return () => window.removeEventListener(FOLDERS_CHANGED_EVENT, load);
  }, [folderId]);

  const remove = async (item: SavedItem) => {
    setData((prev) => prev && { ...prev, items: prev.items.filter((i) => !(i.type === item.type && i.id === item.id)) });
    try {
      await removeFromFolder(folderId, item);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(t.folders.genericError));
    }
  };

  const items = data?.items.filter((i) => filter === "all" || i.type === filter) ?? [];
  const videoCount = data?.items.filter((i) => i.type === "video").length ?? 0;
  const channelCount = (data?.items.length ?? 0) - videoCount;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
      <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" nativeButton={false} render={<Link href="/folders" />}>
        <ArrowLeft className="size-4" />
        {t.folders.back}
      </Button>

      {error instanceof SessionExpiredError && <SessionExpiredState />}
      {error && !(error instanceof SessionExpiredError) && !data && (
        <EmptyState title={t.folders.folderLoadError} description={error.message} />
      )}

      {!data && !error && (
        <>
          <Skeleton className="h-10 w-64" />
          <ItemGrid>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-60" />
            ))}
          </ItemGrid>
        </>
      )}

      {data && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-2xl font-semibold tracking-tight">{data.folder.name}</h2>
              <FolderActionsMenu folder={data.folder} onDeleted={() => router.push("/folders")} />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="all">{t.folders.all(data.items.length)}</TabsTrigger>
                <TabsTrigger value="video">{t.folders.videosTab(videoCount)}</TabsTrigger>
                <TabsTrigger value="channel">{t.folders.channelsTab(channelCount)}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {items.length === 0 ? (
            <EmptyState
              title={data.items.length === 0 ? t.folders.folderEmpty : t.folders.categoryEmpty}
              description={t.folders.folderEmptyHint}
            >
              <Button variant="outline" nativeButton={false} render={<Link href="/trending/top-videos" />}>
                {t.folders.explore}
              </Button>
            </EmptyState>
          ) : (
            <ItemGrid>
              {items.map((item) =>
                item.type === "video" ? (
                  <SavedVideoCard key={`v-${item.id}`} item={item} onRemove={() => remove(item)} />
                ) : (
                  <SavedChannelCard key={`c-${item.id}`} item={item} onRemove={() => remove(item)} />
                ),
              )}
            </ItemGrid>
          )}
        </>
      )}
    </div>
  );
}

function ItemGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  const { t } = useI18n();
  return (
    <Button
      variant="secondary"
      size="icon-sm"
      aria-label={t.folders.remove}
      title={t.folders.remove}
      onClick={onRemove}
      className="absolute top-2 right-2 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <X />
    </Button>
  );
}

function SavedVideoCard({ item, onRemove }: { item: SavedItem; onRemove: () => void }) {
  const { t, compact } = useI18n();
  const s = item.snapshot;
  const url = `https://www.youtube.com/watch?v=${item.id}`;
  return (
    <Card className="group relative gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
      <a href={url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {s.multiplier != null && s.multiplier >= 1 && (
          <span
            className={cn(
              "absolute top-2 left-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold shadow-sm",
              s.multiplier >= 3 ? "bg-emerald-600 text-white" : "bg-white/90 text-slate-900",
            )}
          >
            <Flame className="size-3" />
            {s.multiplier.toFixed(1)}x
          </span>
        )}
      </a>
      <RemoveButton onRemove={onRemove} />
      <div className="flex flex-col gap-2 p-3.5">
        <a href={url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm leading-snug font-medium hover:underline" title={s.title}>
          {s.title}
        </a>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          {s.channelId ? (
            <a
              href={`https://www.youtube.com/channel/${s.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:text-foreground hover:underline"
            >
              {s.channelName ?? t.folders.channel}
            </a>
          ) : (
            <span className="truncate">{s.channelName}</span>
          )}
          <span className="flex shrink-0 items-center gap-2">
            {s.views != null && (
              <span className="flex items-center gap-1 tabular-nums">
                <Eye className="size-3" />
                {compact(s.views)}
              </span>
            )}
            {s.isShort != null && (
              <Badge variant="outline" className="font-normal">
                {s.isShort ? t.common.short : t.common.longVideo}
              </Badge>
            )}
          </span>
        </div>
      </div>
    </Card>
  );
}

function SavedChannelCard({ item, onRemove }: { item: SavedItem; onRemove: () => void }) {
  const { t, compact } = useI18n();
  const s = item.snapshot;
  return (
    <Card className="group relative gap-0 p-0 transition-shadow hover:shadow-md">
      <a
        href={`https://www.youtube.com/channel/${item.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-3 px-4 py-6 text-center"
      >
        <Avatar className="size-16">
          {s.thumbnail && <AvatarImage src={s.thumbnail} alt="" />}
          <AvatarFallback className="text-lg">{s.title.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate font-medium">{s.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[s.handle, s.subscribers != null ? t.common.subscribers(compact(s.subscribers)) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Badge variant="secondary">{t.folders.channel}</Badge>
      </a>
      <RemoveButton onRemove={onRemove} />
    </Card>
  );
}
