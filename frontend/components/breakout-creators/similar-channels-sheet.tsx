"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";

interface SimilarResponse {
  keywords: string[];
  items: {
    id: string;
    name: string;
    handle: string | null;
    avatar: string | null;
    subscribers: number | null;
    country: string | null;
    createdAt: string | null;
    outlierRate: number | null;
    opportunityScore: number | null;
    trendScore: number | null;
    matchingVideos: number;
  }[];
}

export function SimilarChannelsSheet({
  channel,
  onOpenChange,
}: {
  channel: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, compact, ago } = useI18n();
  const ts = t.breakout.similar;
  const [result, setResult] = useState<{ id: string; data?: SimilarResponse; error?: string } | null>(null);

  useEffect(() => {
    if (!channel) return;
    let cancelled = false;
    fetchJson<SimilarResponse>(`/api/channels/${channel.id}/similar`)
      .then((data) => !cancelled && setResult({ id: channel.id, data }))
      .catch((err: Error) => !cancelled && setResult({ id: channel.id, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [channel]);

  const loaded = channel && result?.id === channel.id ? result : null;

  return (
    <Sheet open={channel != null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="size-4" />
            {ts.title}
          </SheetTitle>
          <SheetDescription>
            {channel ? ts.description(channel.name) : ""}
          </SheetDescription>
          {loaded?.data && loaded.data.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {loaded.data.keywords.slice(0, 8).map((k) => (
                <Badge key={k} variant="secondary" className="font-normal">
                  {k}
                </Badge>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4 pb-6">
          {loaded?.error ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.common.loadErrorHint}</p>
          ) : !loaded?.data ? (
            Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : loaded.data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {ts.empty}
            </p>
          ) : (
            loaded.data.items.map((item) => (
              <a
                key={item.id}
                href={`https://www.youtube.com/channel/${item.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <Avatar className="size-10">
                  {item.avatar && <AvatarImage src={item.avatar} alt="" />}
                  <AvatarFallback>{item.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.subscribers != null ? t.common.subscribers(compact(item.subscribers)) : t.common.hiddenSubscribers}
                    {item.createdAt && ` · ${t.time.created(ago(item.createdAt, "day"))}`}
                    {item.outlierRate != null && ` · ${t.common.hitRate(Math.round(item.outlierRate * 100))}`}
                  </span>
                </div>
                {item.opportunityScore != null && (
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {Math.round(item.opportunityScore)}
                  </Badge>
                )}
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </a>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
