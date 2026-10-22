"use client";

import * as React from "react";
import { Check, ExternalLink, Flame, Loader2, NotebookPen, Plus, Sparkles, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOptionLabels } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";
import { FollowButton } from "./follow-button";
import { NOTES_MAX, TAG_MAX, updateFollowed, type FollowKind, type InspirationChannel } from "@/lib/inspirations";
import { cn } from "@/lib/utils";

export function InspirationCard({
  kind,
  channel,
  allTags,
  onChange,
  onTag,
}: {
  kind: FollowKind;
  channel: InspirationChannel;
  /** Every tag the user uses, suggested while typing a new one. */
  allTags: string[];
  onChange: (patch: Pick<InspirationChannel, "tags" | "notes">) => void;
  /** Filters the page on a tag. */
  onTag: (tag: string) => void;
}) {
  const { t, compact, ago, date } = useI18n();
  const ti = t.inspirations.card;
  const labelOf = useOptionLabels("channels");
  const niche = labelOf("niche", channel.niche);
  const subNiche = labelOf("subNiche", channel.subNiche);

  const save = async (patch: { tags?: string[]; notes?: string | null }) => {
    try {
      const saved = await updateFollowed(kind, channel.id, patch);
      onChange(saved);
      return true;
    } catch (err) {
      toast.add({ type: "error", title: ti.saveError, description: err instanceof Error ? err.message : undefined });
      return false;
    }
  };

  return (
    <Card className={cn("gap-4 p-4", channel.newOutliers > 0 && "ring-emerald-500/40")}>
      <div className="flex items-start gap-3">
        <Avatar className="size-10">
          {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
          <AvatarFallback>{channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={`https://www.youtube.com/channel/${channel.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium hover:underline"
            >
              {channel.name}
            </a>
            {channel.newOutliers > 0 && (
              <Badge className="shrink-0 gap-1 bg-emerald-600 text-white">
                <Sparkles className="size-3" />
                {ti.newOutliers(channel.newOutliers)}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{channel.subscribers != null ? t.common.subscribers(compact(channel.subscribers)) : t.common.hiddenSubscribers}</span>
            {channel.lastUploadAt && <span>· {ti.lastUpload(ago(channel.lastUploadAt, "day"))}</span>}
            <span title={date(channel.followedAt, { dateStyle: "medium" })}>· {ti.followedSince(ago(channel.followedAt, "day"))}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{channel.isShortsChannel ? t.common.shorts : t.common.longVideos}</Badge>
            {niche && <Badge variant="secondary">{niche}</Badge>}
            {subNiche && <Badge variant="outline">{subNiche}</Badge>}
            {channel.terminated && <Badge variant="destructive">{ti.terminated}</Badge>}
          </div>
        </div>
        <FollowButton kind={kind} channelId={channel.id} channelName={channel.name} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-2.5 text-center">
        <Insight value={String(channel.outliers)} label={ti.outliers} hint={ti.outliersHint} />
        <Insight
          value={channel.bestMultiplier != null ? `${channel.bestMultiplier.toFixed(1)}x` : "—"}
          label={ti.best}
          hint={ti.bestHint}
        />
        <Insight
          value={channel.medianViews ? compact(channel.medianViews) : "—"}
          label={ti.usualViews}
          hint={ti.usualViewsHint}
        />
      </div>

      {channel.videos.length > 0 ? (
        <ScrollArea className="-mx-1 w-[calc(100%+0.5rem)]">
          <div className="flex gap-3 px-1 pb-3">
            {channel.videos.map((video) => (
              <a
                key={video.id}
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-44 shrink-0 flex-col gap-1.5"
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  {video.multiplier != null && (
                    <span
                      className={cn(
                        "absolute bottom-1.5 left-1.5 flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold",
                        video.multiplier >= 5 ? "bg-emerald-600 text-white" : "bg-black/70 text-white",
                      )}
                    >
                      <Flame className="size-2.5" />
                      {video.multiplier.toFixed(1)}x
                    </span>
                  )}
                  {video.isNew && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-emerald-600 px-1 py-0.5 text-[10px] font-semibold text-white">
                      {ti.new}
                    </span>
                  )}
                  {video.isShort && (
                    <span className="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1 py-0.5 text-[10px] font-medium text-white">
                      {t.common.short}
                    </span>
                  )}
                </div>
                <span className="line-clamp-2 text-xs font-medium group-hover:underline">{video.title}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t.common.views(compact(video.views))} · {ago(video.publishedAt, "day")}
                </span>
              </a>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          {channel.uploads > 0 ? ti.noOutliers : ti.noUploads}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t pt-3">
        <TagEditor
          tags={channel.tags}
          suggestions={allTags}
          onTag={onTag}
          onSave={(tags) => save({ tags })}
        />
        <NotesEditor notes={channel.notes} onSave={(notes) => save({ notes })} />
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<a href={`https://www.youtube.com/channel/${channel.id}/videos`} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="size-4" />
          YouTube
        </Button>
      </div>
    </Card>
  );
}

function TagEditor({
  tags,
  suggestions,
  onTag,
  onSave,
}: {
  tags: string[];
  suggestions: string[];
  onTag: (tag: string) => void;
  onSave: (tags: string[]) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const ti = t.inspirations.card;
  const listId = React.useId();
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const commit = async (next: string[]) => {
    setPending(true);
    const ok = await onSave(next);
    setPending(false);
    return ok;
  };

  const add = async () => {
    const tag = draft.trim().replace(/\s+/g, " ");
    if (!tag) return setAdding(false);
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      return;
    }
    if (await commit([...tags, tag])) {
      setDraft("");
      setAdding(false);
    }
  };

  const others = suggestions.filter((s) => !tags.some((tag) => tag.toLowerCase() === s.toLowerCase()));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="h-6 gap-0.5 rounded-md pr-0.5 pl-0 text-xs font-normal">
          <button
            type="button"
            className="rounded-l-md py-0.5 pl-2 hover:underline"
            title={ti.filterTag(tag)}
            onClick={() => onTag(tag)}
          >
            #{tag}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => commit(tags.filter((x) => x !== tag))}
            className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={ti.removeTag(tag)}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      {adding ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            autoFocus
            value={draft}
            maxLength={TAG_MAX}
            list={listId}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={() => !draft.trim() && setAdding(false)}
            placeholder={ti.tagPlaceholder}
            aria-label={ti.addTag}
            className="h-7 w-36 text-xs"
          />
          <datalist id={listId}>
            {others.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Button type="submit" size="icon-sm" variant="ghost" disabled={pending} aria-label={ti.addTag}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </Button>
        </form>
      ) : (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" onClick={() => setAdding(true)}>
          <Plus className="size-3" />
          {ti.addTag}
        </Button>
      )}
    </div>
  );
}

function NotesEditor({ notes, onSave }: { notes: string | null; onSave: (notes: string | null) => Promise<boolean> }) {
  const { t } = useI18n();
  const ti = t.inspirations.card;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(notes ?? "");
  const [pending, setPending] = React.useState(false);

  const start = () => {
    setDraft(notes ?? "");
    setEditing(true);
  };
  const submit = async () => {
    setPending(true);
    const ok = await onSave(draft.trim() || null);
    setPending(false);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          autoFocus
          value={draft}
          maxLength={NOTES_MAX}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder={ti.notesPlaceholder}
          aria-label={ti.notes}
          className="min-h-20 text-sm md:text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
            {t.common.cancel}
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {t.common.save}
          </Button>
        </div>
      </div>
    );
  }

  return notes ? (
    <button
      type="button"
      onClick={start}
      title={ti.editNotes}
      className="flex gap-2 rounded-lg bg-muted/40 px-3 py-2 text-left text-sm whitespace-pre-line text-muted-foreground transition-colors hover:bg-muted"
    >
      <NotebookPen className="mt-0.5 size-3.5 shrink-0" />
      <span className="line-clamp-4">{notes}</span>
    </button>
  ) : (
    <Button variant="ghost" size="sm" className="h-7 w-fit px-2 text-xs text-muted-foreground" onClick={start}>
      <NotebookPen className="size-3" />
      {ti.addNotes}
    </Button>
  );
}

function Insight({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold tabular-nums">{value}</span>
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</span>
          </div>
        }
      />
      <TooltipContent className="max-w-56">{hint}</TooltipContent>
    </Tooltip>
  );
}
