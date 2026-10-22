"use client";

import * as React from "react";
import Link from "next/link";
import { FolderOpen, FolderPlus, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SessionExpiredState, SessionExpiredError, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { FOLDERS_CHANGED_EVENT, type SavedFolder } from "@/lib/saved-folders";
import { FolderActionsMenu } from "./folder-actions-menu";
import { FolderNameDialog } from "./folder-name-dialog";
import { createFolder } from "./folders-client";

/** /folders: every folder of the user, with create / rename / delete. */
export function FoldersView() {
  const { t } = useI18n();
  const [folders, setFolders] = React.useState<SavedFolder[] | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const load = () =>
      fetchJson<{ folders: SavedFolder[] }>("/api/folders")
        .then(({ folders }) => {
          setFolders(folders);
          setError(null);
        })
        .catch((err: Error) => setError(err));
    load();
    window.addEventListener(FOLDERS_CHANGED_EVENT, load);
    return () => window.removeEventListener(FOLDERS_CHANGED_EVENT, load);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">{t.folders.title}</h2>
          <p className="text-sm text-muted-foreground">{t.folders.intro}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <FolderPlus /> {t.folders.newFolder}
        </Button>
      </div>

      {error instanceof SessionExpiredError && <SessionExpiredState />}
      {error && !(error instanceof SessionExpiredError) && !folders && (
        <EmptyState title={t.folders.loadError} description={error.message} />
      )}

      {!folders && !error && (
        <FolderGrid>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </FolderGrid>
      )}

      {folders?.length === 0 && (
        <EmptyState title={t.folders.empty} description={t.folders.emptyHint}>
          <Button onClick={() => setCreateOpen(true)}>
            <FolderPlus /> {t.folders.createFirst}
          </Button>
        </EmptyState>
      )}

      {folders && folders.length > 0 && (
        <FolderGrid>
          {folders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} />
          ))}
        </FolderGrid>
      )}

      <FolderNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t.folders.newFolder}
        submitLabel={t.folders.create}
        onSubmit={async (name) => {
          await createFolder(name);
        }}
      />
    </div>
  );
}

function FolderGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>;
}

/** Layout of the preview grid by number of thumbnails (1 to 4). */
function previewClass(count: number, index: number) {
  if (count === 1) return "col-span-2 row-span-2";
  if (count === 2 || (count === 3 && index === 0)) return "row-span-2";
  return "";
}

function FolderCard({ folder }: { folder: SavedFolder }) {
  const { t } = useI18n();
  const previews = folder.previews.slice(0, 4);
  return (
    <Card className="group relative gap-0 overflow-hidden p-0 transition-shadow hover:shadow-md">
      <Link href={`/folders/${folder.id}`} className="flex flex-col">
        <div className="relative aspect-video overflow-hidden bg-muted">
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 [&>img]:min-h-0">
            {previews.length === 0 ? (
              <div className="col-span-2 row-span-2 flex items-center justify-center">
                <FolderOpen className="size-10 text-muted-foreground/60" />
              </div>
            ) : (
              previews.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" loading="lazy" className={`size-full object-cover ${previewClass(previews.length, i)}`} />
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 p-3.5 pr-12">
          <p className="truncate font-medium">{folder.name}</p>
          <p className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Video className="size-3" /> {t.folders.videos(folder.videoCount)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3" /> {t.folders.channels(folder.channelCount)}
            </span>
          </p>
        </div>
      </Link>
      <div className="absolute right-2 bottom-3">
        <FolderActionsMenu folder={folder} />
      </div>
    </Card>
  );
}
