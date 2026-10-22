"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/i18n-provider";
import { FolderNameDialog } from "./folder-name-dialog";
import { deleteFolder, renameFolder } from "./folders-client";

/** "…" menu of a folder: rename it, or delete it after a confirmation. */
export function FolderActionsMenu({
  folder,
  onDeleted,
  triggerClassName,
}: {
  folder: { id: string; name: string };
  onDeleted?: () => void;
  triggerClassName?: string;
}) {
  const { t } = useI18n();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteFolder(folder.id);
      setDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.folders.genericError);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t.folders.actions(folder.name)}
          render={<Button variant="ghost" size="icon-sm" className={triggerClassName} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil /> {t.folders.rename}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> {t.folders.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <FolderNameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={t.folders.renameTitle}
        submitLabel={t.folders.rename}
        initialName={folder.name}
        onSubmit={(name) => renameFolder(folder.id, name)}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.folders.deleteTitle(folder.name)}</DialogTitle>
            <DialogDescription>{t.folders.deleteDescription}</DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? t.folders.deleting : t.folders.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
