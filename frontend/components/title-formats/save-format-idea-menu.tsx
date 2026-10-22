"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, FolderOpen, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { FolderNameDialog } from "@/components/folders/folder-name-dialog";
import { addNote, addToFolder, createFolder, listFolders } from "@/components/folders/folders-client";
import type { SavedFolder, SavedItemInput } from "@/lib/saved-folders";
import type { TitleFormat } from "./types";

/**
 * "Save Video Idea": puts the format's best example in a folder and attaches the
 * formula to it as a "title" ideation note, so it shows up on the folder's board.
 */
export function SaveFormatIdeaMenu({ format }: { format: TitleFormat }) {
  const { t } = useI18n();
  const router = useRouter();
  const ts = t.titleFormats.save;
  const [folders, setFolders] = React.useState<SavedFolder[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const example = format.examples[0]?.video;
  if (!example) return null;

  const item: SavedItemInput = {
    type: "video",
    id: example.id,
    snapshot: {
      title: example.title,
      thumbnail: example.thumbnail,
      channelId: example.channel.id,
      channelName: example.channel.name,
      views: example.views,
      multiplier: example.multiplier,
      publishedAt: example.publishedAt,
      isShort: example.isShort,
    },
  };
  const note = { kind: "title" as const, body: format.formula };

  const done = (folder: Pick<SavedFolder, "id" | "name">) =>
    toast.add({
      type: "success",
      title: ts.saved(folder.name),
      actionProps: { children: ts.seeFolder, onClick: () => router.push(`/folders/${folder.id}`) },
    });

  const saveTo = async (folder: SavedFolder) => {
    setPending(true);
    try {
      await addToFolder(folder.id, item);
      await addNote(folder.id, item.id, note);
      done(folder);
    } catch (err) {
      toast.add({ type: "error", title: ts.error, description: err instanceof Error ? err.message : undefined });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) return;
          setError(null);
          listFolders()
            .then(setFolders)
            .catch((err: Error) => setError(err.message));
        }}
      >
        <DropdownMenuTrigger render={<Button variant="secondary" size="sm" disabled={pending} />}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Bookmark className="size-4" />}
          {ts.button}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{ts.menuTitle}</DropdownMenuLabel>
            <p className="px-2 pb-1.5 text-xs text-muted-foreground">{ts.hint}</p>
            {folders === null && !error && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> {t.common.loading}
              </div>
            )}
            {folders?.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">{ts.none}</p>}
            {folders?.map((folder) => (
              <DropdownMenuItem key={folder.id} onClick={() => saveTo(folder)}>
                <FolderOpen className="text-muted-foreground" />
                <span className="truncate">{folder.name}</span>
              </DropdownMenuItem>
            ))}
            {error && <p className="px-2 py-2 text-xs text-destructive">{error}</p>}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <FolderPlus /> {ts.newFolder}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t.folders.newFolder}
        description={ts.newFolderDescription(format.formula)}
        submitLabel={t.folders.createAndSave}
        onSubmit={async (name) => {
          const folder = await createFolder(name, item);
          await addNote(folder.id, item.id, note);
          done(folder);
        }}
      />
    </>
  );
}
