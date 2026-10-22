"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Eye, Lightbulb, Loader2, Plus, Swords } from "lucide-react";
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
import { toast } from "@/components/ui/toast";
import { useI18n } from "@/components/i18n-provider";
import { followChannel, unfollowChannel, useFollowState, type FollowKind } from "@/lib/inspirations";

const PAGES: Record<FollowKind, string> = { inspiration: "/channels/inspirations", competitor: "/channels/competitors" };

/** Follows or unfollows, with a toast; returns whether it worked. */
function useToggleFollow(channelId: string, channelName: string) {
  const { t } = useI18n();
  const tf = t.inspirations.follow;
  const [state, setState] = useFollowState(channelId);
  const [pending, setPending] = React.useState<FollowKind | null>(null);

  const toggle = async (kind: FollowKind, next: boolean) => {
    if (!state || pending) return;
    setPending(kind);
    setState(kind, next);
    try {
      if (next) await followChannel(kind, channelId);
      else await unfollowChannel(kind, channelId);
      toast.add({
        type: "success",
        title: next ? tf.followed[kind](channelName) : tf.unfollowed[kind](channelName),
        ...(next && { description: tf.followedHint[kind] }),
      });
    } catch (err) {
      setState(kind, !next);
      toast.add({ type: "error", title: tf.error, description: err instanceof Error ? err.message : undefined });
    } finally {
      setPending(null);
    }
  };
  return { state, pending, toggle };
}

/** Toggle for one kind, on the cards of the Inspirations and Competitors pages. */
export function FollowButton({
  kind,
  channelId,
  channelName,
  size = "default",
}: {
  kind: FollowKind;
  channelId: string;
  channelName: string;
  size?: "default" | "sm";
}) {
  const { t } = useI18n();
  const tf = t.inspirations.follow;
  const { state, pending, toggle } = useToggleFollow(channelId, channelName);
  const followed = state?.[kind] ?? null;

  return (
    <Button
      variant={followed ? "secondary" : "outline"}
      size={size}
      disabled={followed == null || pending != null}
      onClick={() => followed != null && toggle(kind, !followed)}
      aria-pressed={followed ?? false}
      title={followed ? tf.unfollowHint : tf.followHint[kind]}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : followed ? <Check className="size-4" /> : <Plus className="size-4" />}
      {followed ? tf.following[kind] : tf.follow}
    </Button>
  );
}

/** "Follow" menu for channel cards elsewhere in the app: as an inspiration and/or a competitor. */
export function FollowMenu({ channelId, channelName, className }: { channelId: string; channelName: string; className?: string }) {
  const { t } = useI18n();
  const tf = t.inspirations.follow;
  const { state, pending, toggle } = useToggleFollow(channelId, channelName);
  const followed = state && (state.inspiration || state.competitor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={tf.menuTitle}
        render={<Button variant={followed ? "secondary" : "outline"} className={className} disabled={!state} />}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : followed ? <Check className="size-4" /> : <Eye className="size-4" />}
        <span>{followed ? tf.followingShort : tf.follow}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tf.menuTitle}</DropdownMenuLabel>
          {(["inspiration", "competitor"] as const).map((kind) => (
            <DropdownMenuCheckboxItem
              key={kind}
              checked={Boolean(state?.[kind])}
              disabled={!state || pending != null}
              onCheckedChange={(checked) => toggle(kind, checked)}
            >
              {kind === "inspiration" ? <Lightbulb className="text-muted-foreground" /> : <Swords className="text-muted-foreground" />}
              {tf.as[kind]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {(["inspiration", "competitor"] as const).map((kind) => (
          <DropdownMenuItem key={kind} render={<Link href={PAGES[kind]} />}>
            {tf.seeAll[kind]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
