"use client";

import { AbTestsView } from "./ab-tests-view";
import { MyChannelShell } from "./my-channel-shell";
import { OverviewView } from "./overview-view";
import { RevivalsView } from "./revivals-view";

// One per /my-channel page: the shell takes a render function, which only a client component can pass

export function OverviewTab() {
  return <MyChannelShell tab="overview">{(status, reload) => <OverviewView status={status} reloadToken={reload} />}</MyChannelShell>;
}

export function AbTestsTab() {
  return <MyChannelShell tab="abTests">{(_, reload) => <AbTestsView reloadToken={reload} />}</MyChannelShell>;
}

export function RevivalsTab() {
  return <MyChannelShell tab="revivals">{(_, reload) => <RevivalsView reloadToken={reload} />}</MyChannelShell>;
}
