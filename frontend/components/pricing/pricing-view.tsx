"use client"

import * as React from "react"
import { Check, Lock, RotateCcw, Users, Zap } from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { CURRENCY, PLANS, checkoutUrl, monthlyPrice, yearlyPrice, yearlySaving, type BillingPeriod } from "@/lib/pricing"
import { cn } from "@/lib/utils"

/** /pricing: the plans with a monthly / yearly switch, then the FAQ. */
export function PricingView() {
  const { t, locale } = useI18n()
  const tp = t.pricing
  const [period, setPeriod] = React.useState<BillingPeriod>("yearly")
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: CURRENCY, minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n)
  const bestSaving = Math.max(...PLANS.map((p) => yearlySaving(p.monthly)))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 py-10 md:px-6 md:py-14">
      <header className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <Badge variant="secondary">{tp.eyebrow}</Badge>
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
          {tp.titleStart}{" "}
          <span className="inline-block rounded-md bg-foreground px-2 text-background">{tp.titleHighlight}</span>
        </h1>
        <p className="text-base text-pretty text-muted-foreground">{tp.subtitle}</p>
      </header>

      {/* The switch, and a hand-drawn arrow from the saving note down to the plans */}
      <div className="relative flex items-center gap-3 text-sm font-medium">
        <button
          type="button"
          onClick={() => setPeriod("monthly")}
          className={cn(period === "monthly" ? "text-foreground" : "text-muted-foreground")}
        >
          {tp.monthly}
        </button>
        <Switch
          checked={period === "yearly"}
          onCheckedChange={(on) => setPeriod(on ? "yearly" : "monthly")}
          aria-label={tp.yearly}
        />
        <button
          type="button"
          onClick={() => setPeriod("yearly")}
          className={cn(
            "rounded-md px-1.5 py-0.5",
            period === "yearly" ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          {tp.yearly}
        </button>
        <div className="pointer-events-none absolute top-1/2 left-full ml-3 hidden -translate-y-[85%] items-start gap-1 sm:flex">
          <ArrowToPlans className="mt-3 h-12 w-14 text-foreground" />
          <span className="font-semibold whitespace-nowrap">{tp.save(money(bestSaving))}</span>
        </div>
      </div>
      <p className="-mt-7 text-xs font-medium text-emerald-600 sm:hidden">{tp.save(money(bestSaving))}</p>

      <div className="grid w-full gap-5 md:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan.id === "pro"
          const copy = tp.plans[plan.id]
          return (
            <section
              key={plan.id}
              className={cn(
                "flex flex-col gap-5 rounded-2xl border p-6 shadow-sm",
                featured ? "border-foreground bg-foreground text-background" : "bg-card text-card-foreground",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-sm font-semibold text-white">{copy.name}</span>
                {featured && <span className="text-xs font-medium opacity-70">{tp.popular}</span>}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight tabular-nums lg:text-5xl">{money(monthlyPrice(plan.monthly, period))}</span>
                <span className={cn("text-sm", featured ? "opacity-70" : "text-muted-foreground")}>{tp.perMonth}</span>
              </div>
              <p className={cn("-mt-3 min-h-4 text-xs", featured ? "opacity-70" : "text-muted-foreground")}>
                {period === "yearly" ? tp.billedYearly(money(yearlyPrice(plan.monthly, period))) : tp.billedMonthly}
              </p>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  featured ? "bg-background/15" : "bg-muted",
                )}
              >
                {plan.teamSize ? <Users className="size-4" /> : <Zap className="size-4" />}
                {copy.highlight}
              </div>
              <Button
                size="lg"
                className={cn(
                  "h-11 w-full text-sm font-semibold",
                  featured ? "bg-red-600 text-white hover:bg-red-600/90" : "",
                )}
                nativeButton={false}
                render={<a href={checkoutUrl(plan.id, period)} target="_blank" rel="noopener noreferrer" />}
              >
                {copy.cta}
              </Button>
              <div className="grid gap-3 pt-2">
                <p className="text-sm font-semibold">{copy.audience}</p>
                <ul className="grid gap-2.5 text-sm">
                  {copy.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )
        })}
      </div>

      <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <RotateCcw className="size-4" />
          {tp.reassurance.cancel}
        </li>
        <li className="flex items-center gap-1.5">
          <Lock className="size-4" />
          {tp.reassurance.secure}
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="size-4" />
          {tp.reassurance.refund}
        </li>
      </ul>

      <section className="flex w-full max-w-3xl flex-col gap-5 pt-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{tp.faq.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tp.faq.subtitle}</p>
        </div>
        <Accordion className="rounded-xl border bg-card">
          {tp.faq.items.map((item) => (
            <AccordionItem key={item.q} value={item.q} className="px-2">
              <AccordionTrigger className="py-4 text-sm font-medium">{item.q}</AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  )
}

/** Hand-drawn curved arrow pointing down-left, towards the plans. */
function ArrowToPlans({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M52 6c-6 1-12 4-16 9-3 4-1 8 3 7 4-1 3-7-2-8-8-2-18 6-25 22" />
      <path d="M10 26l2 11 9-5" />
    </svg>
  )
}
