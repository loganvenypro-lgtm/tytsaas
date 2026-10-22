"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  SpellCheck,
  Trash2,
  Type,
  Undo2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { NOTE_BODY_MAX, NOTE_KINDS, type FolderNote, type NoteKind } from "@/lib/saved-folders";
import { addNote, assistNote, deleteNote, updateNote } from "./folders-client";

/** Replaces a video's notes in the folder page state. */
export type NotesUpdater = (videoId: string, update: (notes: FolderNote[]) => FolderNote[]) => void;

export const NOTE_KIND_STYLES: Record<NoteKind, { icon: LucideIcon; chip: string; accent: string }> = {
  idea: {
    icon: Lightbulb,
    chip: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
    accent: "before:bg-amber-500",
  },
  hook: {
    icon: Zap,
    chip: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
    accent: "before:bg-violet-500",
  },
  title: {
    icon: Type,
    chip: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
    accent: "before:bg-sky-500",
  },
};

export function NoteKindChip({ kind, className }: { kind: NoteKind; className?: string }) {
  const { t } = useI18n();
  const { icon: Icon, chip } = NOTE_KIND_STYLES[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ring-1 ring-inset",
        chip,
        className,
      )}
    >
      <Icon className="size-3" />
      {t.ideation.kinds[kind]}
    </span>
  );
}

function KindPicker({ value, onChange }: { value: NoteKind; onChange: (kind: NoteKind) => void }) {
  const { t } = useI18n();
  return (
    <ToggleGroup
      aria-label={t.ideation.kindLabel}
      size="sm"
      spacing={1}
      value={[value]}
      onValueChange={(v) => v[0] && onChange(v[0] as NoteKind)}
    >
      {NOTE_KINDS.map((kind) => {
        const Icon = NOTE_KIND_STYLES[kind].icon;
        return (
          <ToggleGroupItem
            key={kind}
            value={kind}
            className={cn("gap-1 px-2", value === kind && NOTE_KIND_STYLES[kind].chip, value === kind && "ring-1 ring-inset")}
          >
            <Icon />
            {t.ideation.kinds[kind]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

type AssistFn = (input: { mode: AssistMode; kind: NoteKind; body: string }) => Promise<string>;
type AssistMode = "complete" | "fix";

/** Kind picker + textarea (with AI complete / fix), used to write a new note and to edit one. */
function NoteEditor({
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
  assist,
}: {
  initial: { kind: NoteKind; body: string };
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (note: { kind: NoteKind; body: string }) => Promise<void>;
  onCancel: () => void;
  assist: AssistFn;
}) {
  const { t } = useI18n();
  const [kind, setKind] = React.useState(initial.kind);
  const [body, setBody] = React.useState(initial.body);
  const [pending, setPending] = React.useState(false);
  const [aiPending, setAiPending] = React.useState<AssistMode | null>(null);
  // The text before the last AI suggestion, so the user can go back to it.
  const [beforeAi, setBeforeAi] = React.useState<string | null>(null);
  const tooLong = body.length > NOTE_BODY_MAX;
  const canSubmit = body.trim().length > 0 && !tooLong && !pending && !aiPending;
  const hasText = body.trim().length > 0;

  const runAssist = async (mode: AssistMode) => {
    if (aiPending || (mode === "fix" && !hasText)) return;
    setAiPending(mode);
    try {
      const text = await assist({ mode, kind, body });
      setBeforeAi(body);
      setBody(text);
    } catch (err) {
      toast.add({ type: "error", title: t.ideation.aiError, description: err instanceof Error ? err.message : undefined });
    } finally {
      setAiPending(null);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {
      await onSubmit({ kind, body: body.trim() });
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border bg-background p-2.5 shadow-xs"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <KindPicker value={kind} onChange={setKind} />
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={!!aiPending || tooLong}
            onClick={() => runAssist("complete")}
            className="border-violet-500/30 text-violet-700 hover:bg-violet-500/10 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200"
          >
            {aiPending === "complete" ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {hasText ? t.ideation.aiComplete : t.ideation.aiGenerate}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!!aiPending || !hasText || tooLong}
            onClick={() => runAssist("fix")}
            title={t.ideation.aiFixHint}
          >
            {aiPending === "fix" ? <Loader2 className="animate-spin" /> : <SpellCheck />}
            {t.ideation.aiFix}
          </Button>
        </div>
      </div>
      <Textarea
        autoFocus
        value={body}
        disabled={!!aiPending}
        onChange={(e) => {
          setBody(e.target.value);
          setBeforeAi(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
        placeholder={aiPending ? t.ideation.aiPending : t.ideation.placeholders[kind]}
        aria-invalid={tooLong || undefined}
        aria-busy={!!aiPending || undefined}
        className={cn(
          "max-h-80 min-h-20 border-transparent bg-transparent px-1 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:opacity-60 dark:bg-transparent",
          aiPending && "animate-pulse",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {beforeAi !== null && !aiPending ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[0.6875rem] text-violet-700 hover:underline dark:text-violet-300"
            onClick={() => {
              setBody(beforeAi);
              setBeforeAi(null);
            }}
          >
            <Undo2 className="size-3" />
            {t.ideation.aiUndo}
          </button>
        ) : (
          <span className={cn("text-[0.6875rem] text-muted-foreground", tooLong && "text-destructive")}>
            {aiPending ? t.ideation.aiPending : tooLong ? t.ideation.tooLong(NOTE_BODY_MAX) : t.ideation.shortcut}
          </span>
        )}
        <div className="flex gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t.ideation.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={!canSubmit}>
            {pending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function NoteCard({
  note,
  onSave,
  onDelete,
  assist,
}: {
  note: FolderNote;
  assist: AssistFn;
  onSave: (patch: { kind: NoteKind; body: string }) => Promise<void>;
  onDelete: () => void;
}) {
  const { t, ago } = useI18n();
  const [editing, setEditing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  if (editing) {
    return (
      <NoteEditor
        initial={note}
        submitLabel={t.ideation.save}
        pendingLabel={t.folders.saving}
        onCancel={() => setEditing(false)}
        assist={assist}
        onSubmit={async (patch) => {
          await onSave(patch);
          setEditing(false);
        }}
      />
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(note.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const edited = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;

  return (
    <div
      className={cn(
        "group/note relative overflow-hidden rounded-lg border bg-card py-2.5 pr-2.5 pl-3.5 transition-colors hover:border-foreground/20",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        NOTE_KIND_STYLES[note.kind].accent,
      )}
    >
      <div className="flex items-center gap-2">
        <NoteKindChip kind={note.kind} />
        <span className="truncate text-[0.6875rem] text-muted-foreground" title={new Date(note.updatedAt).toLocaleString()}>
          {edited ? t.ideation.edited(ago(note.updatedAt)) : ago(note.createdAt)}
        </span>
        <div className="ml-auto flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/note:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={copied ? t.ideation.copied : t.ideation.copy}
            title={copied ? t.ideation.copied : t.ideation.copy}
            onClick={copy}
          >
            {copied ? <Check className="text-emerald-600" /> : <Copy />}
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label={t.ideation.edit} title={t.ideation.edit} onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t.ideation.delete}
            title={t.ideation.delete}
            onClick={onDelete}
            className="hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <p
        className="mt-1.5 cursor-text text-sm leading-relaxed break-words whitespace-pre-wrap"
        onDoubleClick={() => setEditing(true)}
      >
        {note.body}
      </p>
    </div>
  );
}

/**
 * The notes attached to one saved video, with inline create, edit and delete.
 * `kindFilter` hides the other kinds and preselects that kind for new notes.
 */
export function VideoNotes({
  folderId,
  videoId,
  notes,
  onNotesChange,
  kindFilter,
  className,
}: {
  folderId: string;
  videoId: string;
  notes: FolderNote[];
  onNotesChange: NotesUpdater;
  kindFilter?: NoteKind;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [composing, setComposing] = React.useState(false);
  const assist: AssistFn = (input) => assistNote(folderId, videoId, { ...input, locale });
  const visible = kindFilter ? notes.filter((n) => n.kind === kindFilter) : notes;

  const fail = (err: unknown) => {
    toast.add({ type: "error", title: t.ideation.error, description: err instanceof Error ? err.message : undefined });
  };

  const create = async (note: { kind: NoteKind; body: string }) => {
    try {
      const created = await addNote(folderId, videoId, note);
      onNotesChange(videoId, (prev) => [...prev, created]);
      setComposing(false);
    } catch (err) {
      fail(err);
    }
  };

  const save = async (note: FolderNote, patch: { kind: NoteKind; body: string }) => {
    if (patch.kind === note.kind && patch.body === note.body) return;
    try {
      const updated = await updateNote(folderId, note.id, patch);
      onNotesChange(videoId, (prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    } catch (err) {
      fail(err);
      throw err;
    }
  };

  const remove = async (note: FolderNote) => {
    onNotesChange(videoId, (prev) => prev.filter((n) => n.id !== note.id));
    try {
      await deleteNote(folderId, note.id);
    } catch (err) {
      onNotesChange(videoId, (prev) => [...prev, note].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      return fail(err);
    }
    toast.add({
      title: t.ideation.deleted,
      actionProps: {
        children: t.ideation.undo,
        onClick: () => void create({ kind: note.kind, body: note.body }),
      },
    });
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {visible.length === 0 && !composing && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{t.ideation.noNotes}</p>
      )}
      {visible.map((note) => (
        <NoteCard key={note.id} note={note} onSave={(patch) => save(note, patch)} onDelete={() => remove(note)} assist={assist} />
      ))}
      {composing ? (
        <NoteEditor
          initial={{ kind: kindFilter ?? "idea", body: "" }}
          submitLabel={t.ideation.add}
          pendingLabel={t.ideation.adding}
          onSubmit={create}
          onCancel={() => setComposing(false)}
          assist={assist}
        />
      ) : (
        <Button variant="ghost" size="sm" className="w-fit text-muted-foreground" onClick={() => setComposing(true)}>
          <Plus />
          {t.ideation.newNote}
        </Button>
      )}
    </div>
  );
}
