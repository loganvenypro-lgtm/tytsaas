"use client";

import { useId, useState } from "react";
import { ArrowRight, Check, Copy, Info } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { SaveFormatIdeaMenu } from "./save-format-idea-menu";
import type { TitleFormat, TrendPoint } from "./types";

type Metric = "uploads" | "views" | "outlier";

/** Badge color by boost: grey under the average, then blue, orange, red for the strongest. */
function boostTone(boost: number) {
  if (boost >= 10) return "bg-red-600 text-white";
  if (boost >= 5) return "bg-orange-500 text-white";
  if (boost >= 1.5) return "bg-blue-600 text-white";
  return "bg-muted text-muted-foreground";
}

/** The formula with [X] in grey. */
export function Formula({ prefix, suffix, className }: { prefix: string; suffix: string; className?: string }) {
  return (
    <span className={className}>
      {prefix && `${prefix} `}
      <span className="text-muted-foreground/70">[X]</span>
      {suffix && ` ${suffix}`}
    </span>
  );
}

/** The fixed words of a format, "…" standing for [X] when it sits in the middle. */
export function fixedPart(format: Pick<TitleFormat, "prefix" | "suffix">) {
  return [format.prefix, format.suffix].filter(Boolean).join(" … ");
}

export function FormatCard({ format, onOpenVideos }: { format: TitleFormat; onOpenVideos: () => void }) {
  const { t } = useI18n();
  const tf = t.titleFormats;
  const [copied, setCopied] = useState(false);
  const fixed = fixedPart(format);

  const copy = async () => {
    await navigator.clipboard.writeText(format.formula);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-5 py-4">
        <h3 className="text-base font-semibold tracking-tight">
          <Formula prefix={format.prefix} suffix={format.suffix} />
        </h3>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={tf.copy}>
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              </Button>
            }
          />
          <TooltipContent>{copied ? tf.copied : tf.copy}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="flex cursor-help items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums", boostTone(format.boost))}>
                  {format.boost.toFixed(1)}x
                </span>
                {tf.boost}
              </span>
            }
          />
          <TooltipContent className="max-w-xs">{tf.boostHint(format.boost.toFixed(1))}</TooltipContent>
        </Tooltip>
        <span className="ml-auto text-xs text-muted-foreground">{tf.usage(format.videoCount, format.channelCount)}</span>
      </div>

      <section className="flex flex-col gap-3 border-b px-5 py-4">
        <div className="flex items-center justify-between">
          <SectionTitle>{tf.examples}</SectionTitle>
          <Button variant="secondary" size="sm" onClick={onOpenVideos}>
            {tf.openVideos}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {format.examples.map(({ slot, video }) => (
            <a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-w-0 flex-col gap-2"
              title={video.title}
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.thumbnail}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {video.multiplier != null && video.multiplier >= 1 && (
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/75 px-1 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                    {video.multiplier.toFixed(1)}x
                  </span>
                )}
              </div>
              <div className="flex flex-col text-xs leading-snug">
                <span className="line-clamp-1 font-medium text-foreground group-hover:underline">{fixed}</span>
                <span className="line-clamp-2 text-muted-foreground">{slot}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <TrendSection trend={format.trend} />

      <div className="flex flex-wrap items-center gap-2 px-5 py-3">
        <Tooltip>
          <TooltipTrigger render={<Info className="size-3.5 text-muted-foreground" />} />
          <TooltipContent>{tf.whyHint}</TooltipContent>
        </Tooltip>
        <span className="text-xs text-muted-foreground">{tf.whyTheyClick}</span>
        {format.drivers.map((d) => (
          <span key={d} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
            {tf.drivers[d] ?? d}
          </span>
        ))}
        <div className="ml-auto">
          <SaveFormatIdeaMenu format={format} />
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">{children}</h4>;
}

const chartConfig = {
  value: { theme: { light: "#2563eb", dark: "#60a5fa" } },
} satisfies ChartConfig;

function TrendSection({ trend }: { trend: TrendPoint[] }) {
  const { t, compact, date } = useI18n();
  const tf = t.titleFormats;
  const [metric, setMetric] = useState<Metric>("views");
  const fillId = `format-trend-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const data = trend.map((p) => ({ month: p.month, value: p[metric] }));
  const monthLabel = (month: string) => date(`${month}-01T00:00:00Z`, { month: "short", year: "2-digit", timeZone: "UTC" });
  const format = (v: number) => (metric === "outlier" ? `${v.toFixed(1)}x` : compact(v));

  return (
    <section className="flex flex-col gap-3 border-b px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>{tf.trends}</SectionTitle>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
          <TabsList>
            {(["uploads", "views", "outlier"] as const).map((m) => (
              <TabsTrigger key={m} value={m} className="text-xs">
                {tf.metrics[m]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <ChartContainer config={{ value: { ...chartConfig.value, label: tf.metrics[metric] } }} className="aspect-auto h-36 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={monthLabel} />
          <YAxis hide domain={[0, "auto"]} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => monthLabel(String(payload?.[0]?.payload?.month ?? ""))}
                formatter={(value) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-muted-foreground">{tf.metrics[metric]}</span>
                    <span className="font-medium tabular-nums">{value == null ? "—" : format(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <Area
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill={`url(#${fillId})`}
            connectNulls
          />
        </AreaChart>
      </ChartContainer>
    </section>
  );
}
