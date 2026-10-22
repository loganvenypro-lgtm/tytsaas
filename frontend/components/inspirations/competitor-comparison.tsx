"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/components/i18n-provider";
import type { ChannelStats } from "@/lib/inspirations";
import { cn } from "@/lib/utils";

/**
 * My channel next to my competitors: audience, usual views, pace and hits over
 * the page's period. The best value of each column is highlighted.
 */
export function CompetitorComparison({ me, competitors }: { me: ChannelStats | null; competitors: ChannelStats[] }) {
  const { t, compact } = useI18n();
  const tc = t.inspirations.compare;
  const rows = [...(me ? [{ ...me, isMe: true }] : []), ...competitors.map((c) => ({ ...c, isMe: false }))];

  const columns: { key: string; label: string; value: (c: ChannelStats) => number | null; format: (n: number) => string }[] = [
    { key: "subs", label: tc.subscribers, value: (c) => c.subscribers, format: compact },
    { key: "median", label: tc.usualViews, value: (c) => c.medianViews || null, format: compact },
    { key: "pace", label: tc.perWeek, value: (c) => c.uploadsPerWeek, format: (n) => n.toFixed(1) },
    { key: "rate", label: tc.hitRate, value: (c) => c.outlierRate, format: (n) => t.common.percent(Math.round(n * 100)) },
    { key: "outliers", label: tc.outliers, value: (c) => c.outliers, format: (n) => String(n) },
    { key: "best", label: tc.best, value: (c) => c.bestMultiplier, format: (n) => `${n.toFixed(1)}x` },
  ];
  // Best value of each column, when the column has a winner (not all equal)
  const best = Object.fromEntries(
    columns.map((col) => {
      const values = rows.map((r) => col.value(r)).filter((v): v is number => v != null);
      const max = Math.max(...values);
      return [col.key, values.length > 1 && Math.min(...values) < max ? max : null];
    }),
  );

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-col gap-0.5 border-b px-4 py-3">
        <span className="text-sm font-medium">{tc.title}</span>
        <span className="text-xs text-muted-foreground">{me ? tc.description : tc.noChannel}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{tc.channel}</TableHead>
            {columns.map((col) => (
              <TableHead key={col.key} className="text-right">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.isMe}-${row.id}`} className={cn(row.isMe && "bg-primary/5")}>
              <TableCell className="max-w-56 pl-4">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    {row.avatar && <AvatarImage src={row.avatar} alt="" />}
                    <AvatarFallback className="text-[10px]">{row.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium">{row.name}</span>
                  {row.isMe && <Badge variant="secondary">{tc.me}</Badge>}
                </div>
              </TableCell>
              {columns.map((col) => {
                const value = col.value(row);
                return (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "text-right tabular-nums",
                      value != null && value === best[col.key] && "font-semibold text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {value != null ? col.format(value) : "—"}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
