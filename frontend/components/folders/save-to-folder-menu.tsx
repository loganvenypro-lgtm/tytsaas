"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, FolderOpen, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import type { SavedFolder, SavedItemInput } from "@/lib/saved-folders";
import { FolderNameDialog } from "./folder-name-dialog";
import { addToFolder, createFolder, listFolders, removeFromFolder } from "./folders-client";

/**
 * "Save to folder" menu for a video or channel: tick the folders that should hold
 * it, or create a new folder that starts with it.
 */
export function SaveToFolderMenu({
  item,
  variant = "button",
  className,
}: {
  item: SavedItemInput;
  /** "overlay": round icon button for thumbnails; "button": outline button with a label. */
  variant?: "overlay" | "button";
  className?: string;
}) {
  const { t } = useI18n();
  const ts = t.folders.save;
  const [folders, setFolders] = React.useState<SavedFolder[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = () => {
    setError(null);
    listFolders(item)
      .then(setFolders)
      .catch((err: Error) => setError(err.message));
  };

  const saved = folders?.some((f) => f.containsItem) ?? false;

  const toggle = async (folder: SavedFolder, checked: boolean) => {
    setPending(folder.id);
    setFolders((prev) => prev?.map((f) => (f.id === folder.id ? { ...f, containsItem: checked } : f)) ?? prev);
    try {
      if (checked) await addToFolder(folder.id, item);
      else await removeFromFolder(folder.id, item);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.folders.genericError);
      setFolders((prev) => prev?.map((f) => (f.id === folder.id ? { ...f, containsItem: !checked } : f)) ?? prev);
    } finally {
      setPending(null);
    }
  };

  const Icon = saved ? BookmarkCheck : Bookmark;
  const label = item.type === "video" ? ts.video : ts.channel;

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && load()}>
        <DropdownMenuTrigger
          aria-label={label}
          title={label}
          render={
            variant === "overlay" ? (
              <button
                type="button"
                className={cn(
                  "flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm ring-1 ring-foreground/10 backdrop-blur transition hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  className,
                )}
              />
            ) : (
              <Button variant="outline" className={className} />
            )
          }
        >
          <Icon className={cn("size-4", saved && "text-primary")} />
          {variant === "button" && <span>{saved ? ts.saved : ts.button}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{ts.menuTitle}</DropdownMenuLabel>
            {folders === null && !error && (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> {t.common.loading}
              </div>
            )}
            {folders?.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">{ts.none}</p>}
            {folders?.map((folder) => (
              <DropdownMenuCheckboxItem
                key={folder.id}
                checked={Boolean(folder.containsItem)}
                disabled={pending === folder.id}
                onCheckedChange={(checked) => toggle(folder, checked)}
              >
                <FolderOpen className="text-muted-foreground" />
                <span className="truncate">{folder.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
            {error && <p className="px-2 py-2 text-xs text-destructive">{error}</p>}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <FolderPlus /> {ts.newFolder}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/folders" />}>
            <Bookmark /> {ts.seeAll}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t.folders.newFolder}
        description={t.folders.willBeSaved(item.snapshot.title)}
        submitLabel={t.folders.createAndSave}
        onSubmit={async (name) => {
          const folder = await createFolder(name, item);
          setFolders((prev) => [folder, ...(prev ?? [])]);
        }}
      />
    </>
  );
}
