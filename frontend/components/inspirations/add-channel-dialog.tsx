"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useOptionLabels } from "@/components/explorer/filter-spec";
import { useI18n } from "@/components/i18n-provider";
import { searchChannels, type ChannelSearchResult, type FollowKind } from "@/lib/inspirations";
import { FollowButton } from "./follow-button";

/** Search the channels of the database by name or @handle, and follow them as this kind. */
export function AddChannelDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: FollowKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, compact } = useI18n();
  const ta = t.inspirations.add;
  const labelOf = useOptionLabels("channels");
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<{ q: string; channels: ChannelSearchResult[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const q = query.trim();
  const loading = q.length >= 2 && result?.q !== q && !error;

  React.useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchChannels(q)
        .then((channels) => !cancelled && setResult({ q, channels }))
        .catch((err: Error) => !cancelled && setError(err.message));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const channels = q.length >= 2 && result?.q === q ? result.channels : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ta.title[kind]}</DialogTitle>
          <DialogDescription>{ta.description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => {
              setError(null);
              setQuery(e.target.value);
            }}
            placeholder={ta.placeholder}
            aria-label={ta.placeholder}
            className="h-10 pl-9"
          />
          {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {error && <p className="px-1 py-2 text-sm text-destructive">{error}</p>}
          {!error && q.length >= 2 && result?.q === q && channels.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">{ta.none}</p>
          )}
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/60">
              <Avatar className="size-9">
                {channel.avatar && <AvatarImage src={channel.avatar} alt="" />}
                <AvatarFallback>{channel.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{channel.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {[
                    channel.handle,
                    channel.subscribers != null ? t.common.subscribers(compact(channel.subscribers)) : null,
                    labelOf("niche", channel.niche),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <FollowButton kind={kind} channelId={channel.id} channelName={channel.name} size="sm" />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{ta.notInDatabase}</p>
      </DialogContent>
    </Dialog>
  );
}
