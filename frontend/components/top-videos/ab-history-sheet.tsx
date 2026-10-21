"use client";

import { useEffect, useState } from "react";
import { ImageOff, SplitSquareHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";

// GET /api/videos/:id/variants, oldest first
interface VariantsResponse {
  videoId: string;
  titles: { title: string; firstSeenAt: string | null; lastSeenAt: string | null }[];
  thumbnails: {
    version: string;
    setAt: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    image: string | null;
  }[];
}

/** Title and thumbnail history of one video (A/B tests and changes after publishing). */
export function AbHistorySheet({
  video,
  open,
  onOpenChange,
}: {
  video: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, date } = useI18n();
  const ta = t.topVideos.ab;
  const [result, setResult] = useState<{ data?: VariantsResponse; error?: string } | null>(null);

  useEffect(() => {
    if (!open || result?.data) return;
    let cancelled = false;
    fetchJson<VariantsResponse>(`/api/videos/${encodeURIComponent(video.id)}/variants`)
      .then((data) => !cancelled && setResult({ data }))
      .catch((err: Error) => !cancelled && setResult({ error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [open, video.id, result?.data]);

  const day = (value: string) => date(value, { dateStyle: "medium" });
  const seen = (from: string | null, to: string | null) => (from && to ? ta.period(day(from), day(to)) : null);
  const data = result?.data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SplitSquareHorizontal className="size-4" />
            {ta.title}
          </SheetTitle>
          <SheetDescription className="line-clamp-2">{video.title}</SheetDescription>
          <p className="text-xs text-muted-foreground">{ta.description}</p>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 pb-6">
          {result?.error ? (
            <p className="text-sm text-muted-foreground">{ta.loadError}</p>
          ) : !data ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="aspect-video rounded-lg" />
              ))}
            </div>
          ) : data.thumbnails.length === 0 && data.titles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ta.empty}</p>
          ) : (
            <>
              {data.thumbnails.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {ta.thumbnails} <span className="text-muted-foreground">· {data.thumbnails.length}</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {data.thumbnails.map((thumb, i) => (
                      <figure key={thumb.version} className="flex flex-col gap-1.5">
                        <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                          {thumb.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb.image} alt="" loading="lazy" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
                              <ImageOff className="size-4" />
                              {ta.noImage}
                            </div>
                          )}
                          {i === data.thumbnails.length - 1 && (
                            <Badge className="absolute top-1.5 left-1.5">{ta.current}</Badge>
                          )}
                        </div>
                        <figcaption className="text-[11px] text-muted-foreground">
                          {thumb.setAt ? ta.setAt(day(thumb.setAt)) : seen(thumb.firstSeenAt, thumb.lastSeenAt)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              )}
              {data.titles.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {ta.titles} <span className="text-muted-foreground">· {data.titles.length}</span>
                  </h3>
                  <ol className="flex flex-col gap-2">
                    {data.titles.map((title, i) => (
                      <li key={`${i}-${title.title}`} className="flex flex-col gap-0.5 rounded-lg border p-2.5">
                        <span className="flex items-start justify-between gap-2 text-sm font-medium">
                          {title.title}
                          {i === data.titles.length - 1 && <Badge className="shrink-0">{ta.current}</Badge>}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{seen(title.firstSeenAt, title.lastSeenAt)}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
