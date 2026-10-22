"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/components/explorer/explorer-ui";
import { OutlierCard } from "@/components/top-videos/outlier-card";
import { useI18n } from "@/components/i18n-provider";
import { Formula } from "./format-card";
import type { FormatExample, TitleFormat } from "./types";

/** "Open Videos": every video using a format (GET /api/formats/:id/videos). */
export function FormatVideosSheet({ format, onOpenChange }: { format: TitleFormat | null; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n();
  const tf = t.titleFormats;
  const [result, setResult] = useState<{ id: string; items?: FormatExample[]; error?: string } | null>(null);
  const id = format?.id;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchJson<{ items: FormatExample[] }>(`/api/formats/${encodeURIComponent(id)}/videos`)
      .then((data) => !cancelled && setResult({ id, items: data.items }))
      .catch((err: Error) => !cancelled && setResult({ id, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = result?.id === id ? result : null;

  return (
    <Sheet open={format !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-3xl">
        {format && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-8 text-base">
                <Formula prefix={format.prefix} suffix={format.suffix} />
              </SheetTitle>
              <SheetDescription>{tf.sheet.description(format.videoCount)}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {current?.error ? (
                <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {tf.sheet.loadError} · {current.error}
                </p>
              ) : !current?.items ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="aspect-video w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {current.items.map(({ video }) => (
                    <OutlierCard key={video.id} video={video} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
