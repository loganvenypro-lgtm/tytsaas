"use client";

import * as React from "react";
import { Clapperboard, Eye, Flame, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { NOTE_KINDS, type NoteKind, type SavedItem } from "@/lib/saved-folders";
import { NOTE_KIND_STYLES, VideoNotes, type NotesUpdater } from "./video-notes";

type Format = "short" | "long";

/** Videos whose format is unknown (not in our database) count as long-form. */
const formatOf = (item: SavedItem): Format => (item.snapshot.isShort ? "short" : "long");

/**
 * The folder's "Ideation" tab: every saved video with its notes, split into
 * Shorts and long-form, filterable by note kind.
 */
export function IdeationBoard({
  folderId,
  items,
  onNotesChange,
}: {
  folderId: string;
  items: SavedItem[];
  onNotesChange: NotesUpdater;
}) {
  const { t } = useI18n();
  const videos = React.useMemo(() => items.filter((i) => i.type === "video"), [items]);
  const byFormat = React.useMemo(() => {
    const groups: Record<Format, SavedItem[]> = { short: [], long: [] };
    for (const v of videos) groups[formatOf(v)].push(v);
    return groups;
  }, [videos]);
  const noteCount = (list: SavedItem[], kind?: NoteKind) =>
    list.reduce((sum, v) => sum + (v.notes ?? []).filter((n) => !kind || n.kind === kind).length, 0);

  const [format, setFormat] = React.useState<Format>(() =>
    byFormat.short.length > byFormat.long.length ? "short" : "long",
  );
  const [kind, setKind] = React.useState<NoteKind | "all">("all");

  const inFormat = byFormat[format];
  // With a kind picked, only the videos that have such notes. Rows keep the
  // folder's order so they don't jump around while the user writes.
  const rows = kind === "all" ? inFormat : inFormat.filter((v) => v.notes?.some((n) => n.kind === kind));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={format} onValueChange={(v) => setFormat(v as Format)}>
          <TabsList aria-label={t.ideation.formatLabel}>
            <TabsTrigger value="short" className="px-2.5">
              <Smartphone />
              {t.ideation.shorts(noteCount(byFormat.short))}
            </TabsTrigger>
            <TabsTrigger value="long" className="px-2.5">
              <Clapperboard />
              {t.ideation.long(noteCount(byFormat.long))}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <ToggleGroup
          aria-label={t.ideation.kindLabel}
          size="sm"
          spacing={1}
          value={[kind]}
          onValueChange={(v) => v[0] && setKind(v[0] as NoteKind | "all")}
          className="flex-wrap"
        >
          <ToggleGroupItem value="all" className="px-2.5">
            {t.ideation.allKinds}
            <Count n={noteCount(inFormat)} />
          </ToggleGroupItem>
          {NOTE_KINDS.map((k) => {
            const Icon = NOTE_KIND_STYLES[k].icon;
            return (
              <ToggleGroupItem key={k} value={k} className="gap-1 px-2.5">
                <Icon />
                {t.ideation.kindsPlural[k]}
                <Count n={noteCount(inFormat, k)} />
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      {inFormat.length === 0 ? (
        <EmptyState
          title={format === "short" ? t.ideation.emptyShort : t.ideation.emptyLong}
          description={t.ideation.emptyHint}
        />
      ) : rows.length === 0 ? (
        <EmptyState title={t.ideation.filterEmpty} description={t.ideation.filterEmptyHint} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((video) => (
            <IdeationRow
              key={video.id}
              folderId={folderId}
              video={video}
              onNotesChange={onNotesChange}
              kindFilter={kind === "all" ? undefined : kind}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-0.5 rounded-sm bg-foreground/5 px-1 tabular-nums text-muted-foreground">{n}</span>;
}

function IdeationRow({
  folderId,
  video,
  onNotesChange,
  kindFilter,
}: {
  folderId: string;
  video: SavedItem;
  onNotesChange: NotesUpdater;
  kindFilter?: NoteKind;
}) {
  const { t } = useI18n();
  const notes = video.notes ?? [];
  return (
    <Card className="gap-0 overflow-hidden p-0 md:flex-row">
      <VideoSummary video={video} className="md:w-72 md:shrink-0 md:border-r" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
          {t.ideation.noteCount(notes.length)}
        </p>
        <VideoNotes folderId={folderId} videoId={video.id} notes={notes} onNotesChange={onNotesChange} kindFilter={kindFilter} />
      </div>
    </Card>
  );
}

/** Thumbnail, title and stats of a saved video, shared by the ideation rows and the notes sheet. */
export function VideoSummary({ video, className }: { video: SavedItem; className?: string }) {
  const { t, compact } = useI18n();
  const s = video.snapshot;
  const url = `https://www.youtube.com/watch?v=${video.id}`;
  return (
    <div className={cn("flex flex-col", className)}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="group relative block aspect-video overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={s.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
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
      <div className="flex flex-col gap-1 p-3.5">
        <a href={url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm leading-snug font-medium hover:underline" title={s.title}>
          {s.title}
        </a>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{s.channelName}</span>
          <span className="flex shrink-0 items-center gap-2">
            {s.views != null && (
              <span className="flex items-center gap-1 tabular-nums">
                <Eye className="size-3" />
                {compact(s.views)}
              </span>
            )}
            {s.isShort == null && (
              <span className="cursor-help underline decoration-dotted" title={t.ideation.unknownFormat}>
                ?
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
