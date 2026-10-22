"use client";

import * as React from "react";
import { BadgeCheck, ExternalLink, Loader2, Lock, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, SessionExpiredError, SessionExpiredState, fetchJson } from "@/components/explorer/explorer-ui";
import { useI18n } from "@/components/i18n-provider";
import { oauthErrorMessage } from "@/components/social-sign-in-button";
import { authClient } from "@/lib/auth-client";
import {
  MY_CHANNEL_CHANGED_EVENT,
  MyChannelError,
  YOUTUBE_SCOPES,
  connectMyChannel,
  syncMyChannel,
  type MyChannelStatus,
} from "@/lib/my-channel";

export type MyChannelTab = "overview" | "abTests" | "revivals";

const TAB_URLS: Record<MyChannelTab, string> = {
  overview: "/my-channel/overview",
  abTests: "/my-channel/ab-tests",
  revivals: "/my-channel/revivals",
};

/** The error text for a failed call: the backend's code through t.myChannel.errors, else its message. */
export function useErrorText() {
  const { t } = useI18n();
  return (err: unknown) =>
    (err instanceof MyChannelError && err.code && t.myChannel.errors[err.code]) || (err instanceof Error ? err.message : undefined);
}

/**
 * Sends the user to Google to grant read-only YouTube (+ Analytics) access on
 * top of their account (Better Auth "link social"). Google comes back to the
 * same page with ?linked=1, where the shell finishes the connection.
 */
export function ConnectYoutubeButton({
  tab,
  label,
  variant = "default",
  size = "default",
}: {
  tab: MyChannelTab;
  label?: string;
  variant?: "default" | "outline";
  size?: "default" | "sm";
}) {
  const { t } = useI18n();
  const tc = t.myChannel.connect;
  const [pending, setPending] = React.useState(false);

  const connect = async () => {
    setPending(true);
    const { error } = await authClient.linkSocial({
      provider: "google",
      scopes: YOUTUBE_SCOPES,
      callbackURL: `${TAB_URLS[tab]}?linked=1`,
      errorCallbackURL: TAB_URLS[tab],
      // A refresh token, so the backend can read Analytics after this visit
      additionalParams: { access_type: "offline", prompt: "consent" },
    });
    // On success the browser is already on its way to Google
    if (error) {
      toast.add({ type: "error", title: tc.failed, description: error.message });
      setPending(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={connect} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
      {pending ? tc.pending : (label ?? tc.button)}
    </Button>
  );
}

function ConnectCard({ tab }: { tab: MyChannelTab }) {
  const { t } = useI18n();
  const tc = t.myChannel.connect;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-xl border bg-card px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
          <path
            fill="currentColor"
            d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"
          />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{tc.title}</h3>
        <p className="text-sm text-muted-foreground">{tc.description}</p>
      </div>
      <ConnectYoutubeButton tab={tab} />
      <ul className="flex flex-col gap-1.5 text-left text-xs text-muted-foreground">
        <li className="flex gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0" />
          {tc.readOnly}
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          {tc.scopes}
        </li>
        <li className="flex gap-2">
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0" />
          {tc.brandHint}
        </li>
      </ul>
    </div>
  );
}

function ChannelHeader({ status, onSynced }: { status: MyChannelStatus; onSynced: () => void }) {
  const { t, compact, ago } = useI18n();
  const th = t.myChannel.header;
  const errorText = useErrorText();
  const [syncing, setSyncing] = React.useState(false);
  const channel = status.channel;

  const sync = async () => {
    setSyncing(true);
    try {
      const { videos } = await syncMyChannel();
      toast.add({ type: "success", title: th.syncDone(videos) });
      onSynced();
    } catch (err) {
      toast.add({ type: "error", title: th.syncFailed, description: errorText(err) });
    } finally {
      setSyncing(false);
    }
  };

  const name = channel?.name ?? status.channelId ?? "";
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-12">
          {channel?.avatar && <AvatarImage src={channel.avatar} alt="" />}
          <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold">{name}</span>
            {status.linkedAt ? (
              <Badge variant="secondary" className="gap-1">
                <BadgeCheck className="size-3" />
                {th.linked}
              </Badge>
            ) : (
              <Badge variant="outline">{th.fromOnboarding}</Badge>
            )}
          </div>
          <span className="truncate text-xs text-muted-foreground">
            {[
              channel?.handle,
              channel?.subscribers != null && t.common.subscribers(compact(channel.subscribers)),
              channel && channel.videoCount != null && th.coverage(channel.videosInDb, compact(channel.videoCount)),
              status.syncedAt && th.synced(ago(status.syncedAt)),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`https://www.youtube.com/channel/${status.channelId}`} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="size-4" />
          {th.openYoutube}
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="outline" size="sm" onClick={sync} disabled={syncing || !status.canSync}>
                {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {syncing ? th.syncing : th.sync}
              </Button>
            }
          />
          <TooltipContent>{th.syncHint}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function Banner({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        {children}
      </span>
      {action}
    </div>
  );
}

/**
 * Frame of the /my-channel pages: title, the user's channel with its link and
 * sync state, and the connect card when there is no channel yet. Finishes the
 * Google link when the page comes back with ?linked=1. `children` renders the
 * tab once a channel the database knows is there.
 */
export function MyChannelShell({
  tab,
  actions,
  children,
}: {
  tab: MyChannelTab;
  actions?: React.ReactNode;
  children: (status: MyChannelStatus, reloadToken: number) => React.ReactNode;
}) {
  const { t } = useI18n();
  const tm = t.myChannel;
  const page = tm.pages[tab];
  const errorText = useErrorText();

  const [status, setStatus] = React.useState<MyChannelStatus | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [connecting, setConnecting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchJson<MyChannelStatus>("/api/my-channel")
      .then((data) => {
        if (cancelled) return;
        setStatus(data);
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  React.useEffect(() => {
    const reload = () => setReloadToken((n) => n + 1);
    window.addEventListener(MY_CHANNEL_CHANGED_EVENT, reload);
    return () => window.removeEventListener(MY_CHANNEL_CHANGED_EVENT, reload);
  }, []);

  // Back from Google: ?linked=1 → ask YouTube which channel it is; ?error=… → say why it failed
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    if (!params.has("linked") && !oauthError) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (oauthError) {
      toast.add({ type: "error", title: tm.connect.failed, description: oauthErrorMessage(oauthError, t) ?? undefined });
      return;
    }
    Promise.resolve()
      .then(() => {
        setConnecting(true);
        return connectMyChannel();
      })
      .then(({ name, syncing }) => {
        toast.add({ type: "success", title: tm.connect.connected(name), description: syncing ? tm.connect.syncing : undefined });
        window.dispatchEvent(new Event(MY_CHANNEL_CHANGED_EVENT));
        // The first sync runs in the background: reload once it has had time to land
        if (syncing) window.setTimeout(() => window.dispatchEvent(new Event(MY_CHANNEL_CHANGED_EVENT)), 15_000);
      })
      .catch((err) => toast.add({ type: "error", title: tm.connect.failed, description: errorText(err) }))
      .finally(() => setConnecting(false));
    // Runs once, on the page Google sent the user back to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showAnalyticsBanner = status?.linkedAt && status.connection.youtube && !status.connection.analytics;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-4 py-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">{page.title}</h2>
            <p className="text-sm text-muted-foreground">{page.description}</p>
          </div>
          {status?.channel && actions}
        </div>

        {error ? (
          error instanceof SessionExpiredError ? (
            <SessionExpiredState />
          ) : (
            <EmptyState title={tm.loadError} description={t.common.loadErrorHint}>
              <Button variant="outline" size="sm" onClick={() => setReloadToken((n) => n + 1)}>
                {t.common.retry}
              </Button>
            </EmptyState>
          )
        ) : !status || connecting ? (
          <div className="flex flex-col gap-4">
            {connecting && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {tm.connect.connecting}
              </p>
            )}
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        ) : !status.channelId ? (
          <ConnectCard tab={tab} />
        ) : (
          <>
            <ChannelHeader status={status} onSynced={() => setReloadToken((n) => n + 1)} />
            {!status.linkedAt && (
              <Banner action={<ConnectYoutubeButton tab={tab} size="sm" variant="outline" />}>
                {tm.connect.onboardingBanner(status.channel?.name ?? status.channelId)}
              </Banner>
            )}
            {showAnalyticsBanner && (
              <Banner action={<ConnectYoutubeButton tab={tab} size="sm" variant="outline" label={tm.connect.reconnect} />}>
                {tm.connect.analyticsBanner}
              </Banner>
            )}
            {status.channel ? (
              children(status, reloadToken)
            ) : (
              <EmptyState title={tm.notSynced.title} description={tm.notSynced.description} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
