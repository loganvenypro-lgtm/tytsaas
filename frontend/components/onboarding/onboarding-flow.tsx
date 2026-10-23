"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Megaphone,
  Rocket,
  Search,
  SquarePlay,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { ReturbeMark } from "@/components/returbe-logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { identifyCurrentUser, track } from "@/lib/analytics"
import { cn } from "@/lib/utils"

type Role = "creator" | "agency" | "brand" | "aspiring"
type Step = "role" | "channel" | "competitors"
type Label = { en: string; fr: string }

type FoundChannel = {
  id: string
  name: string
  handle: string | null
  avatar: string | null
  subscribers: number | null
  niche: { id: string; label: Label } | null
  inDatabase: boolean
}

type Suggestion = { id: string; name: string; handle: string | null; avatar: string | null; subscribers: number | null }

const ROLES: { id: Role; icon: React.ElementType }[] = [
  { id: "creator", icon: SquarePlay },
  { id: "agency", icon: Building2 },
  { id: "brand", icon: Megaphone },
  { id: "aspiring", icon: Rocket },
]

const STEPS: Step[] = ["role", "channel", "competitors"]

// Well-known channels to try the search with
const EXAMPLES = ["@Squeezie", "@veritasium", "@aliabdaal"]

// Calm palette: white surfaces from the theme, the brand red (globals.css) as the only accent
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand/20 transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40"
const linkButton = "text-sm text-muted-foreground transition-colors hover:text-foreground"

function ChannelAvatar({ src, name, className }: { src: string | null; name: string; className?: string }) {
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/** /onboarding: profile, channel (or future niche) and the channels to follow, then the home page. */
export function OnboardingFlow() {
  const { t, locale, compact } = useI18n()
  const o = t.onboarding
  const router = useRouter()

  const [step, setStep] = React.useState<Step>("role")
  const [role, setRole] = React.useState<Role | null>(null)
  const [noChannel, setNoChannel] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [channel, setChannel] = React.useState<FoundChannel | null>(null)
  const [niches, setNiches] = React.useState<{ id: string; label: Label }[] | null>(null)
  const [niche, setNiche] = React.useState<string | null>(null)
  const [suggestions, setSuggestions] = React.useState<Suggestion[] | null>(null)
  const [picked, setPicked] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const startedAt = React.useRef(0)

  React.useEffect(() => {
    startedAt.current = Date.now()
    // Signed up without a page load: tie these events to the account now
    identifyCurrentUser()
  }, [])

  React.useEffect(() => {
    window.scrollTo({ top: 0 })
    track("onboarding_step_viewed", { step, step_index: STEPS.indexOf(step) + 1 })
  }, [step])

  const loadNiches = async () => {
    if (niches) return
    try {
      const res = await fetch("/api/taxonomy")
      if (!res.ok) throw new Error()
      const data: { niches: { id: string; label: Label }[] } = await res.json()
      setNiches(data.niches)
    } catch {
      setError(o.channel.nichesFailed)
    }
  }

  const chooseRole = () => {
    const aspiring = role === "aspiring"
    track("onboarding_role_selected", { role })
    setNoChannel(aspiring)
    setError(null)
    if (aspiring) loadNiches()
    setStep("channel")
  }

  const toggleNoChannel = () => {
    if (!noChannel) loadNiches()
    track("onboarding_no_channel_toggled", { no_channel: !noChannel, role })
    setNoChannel(!noChannel)
    setError(null)
  }

  const searchChannel = async (value = input) => {
    const q = value.trim()
    if (!q) return
    setInput(q)
    setSearching(true)
    setError(null)
    setChannel(null)
    try {
      const res = await fetch(`/api/onboarding/channel?${new URLSearchParams({ q })}`)
      if (!res.ok) throw new Error()
      const found: FoundChannel = (await res.json()).channel
      setChannel(found)
      track("onboarding_channel_searched", { found: true, in_database: found.inDatabase, example: EXAMPLES.includes(q), niche: found.niche?.id ?? null })
    } catch {
      track("onboarding_channel_searched", { found: false, example: EXAMPLES.includes(q) })
      setError(o.channel.notFound)
    } finally {
      setSearching(false)
    }
  }

  // Similar channels to my channel, or the leaders of the niche I picked
  const goToCompetitors = async () => {
    setStep("competitors")
    setSuggestions(null)
    let items: Suggestion[] = []
    try {
      const url = noChannel ? `/api/onboarding/niche/${niche}` : channel?.inDatabase ? `/api/channels/${channel.id}/similar` : null
      if (url) {
        const res = await fetch(url)
        if (res.ok) items = (await res.json()).items
      }
    } catch {
      // No suggestions: the user can still finish
    }
    setSuggestions(items)
    setPicked(items.slice(0, 3).map((c) => c.id))
    track("onboarding_competitors_suggested", {
      role,
      no_channel: noChannel,
      niche: noChannel ? niche : (channel?.niche?.id ?? null),
      in_database: noChannel ? null : (channel?.inDatabase ?? false),
      suggested: items.length,
    })
  }

  const finish = async (skipped = false) => {
    setSaving(true)
    setError(null)
    const ownChannel = noChannel ? null : channel
    const properties = {
      role,
      step,
      no_channel: noChannel,
      has_channel: !!ownChannel,
      niche: noChannel ? niche : (ownChannel?.niche?.id ?? null),
      competitors_tracked: (suggestions ?? []).filter((c) => picked.includes(c.id)).length,
      competitors_suggested: suggestions?.length ?? 0,
      duration_ms: Date.now() - startedAt.current,
    }
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          skipped,
          input: noChannel ? null : input || null,
          niche: noChannel ? niche : (ownChannel?.niche?.id ?? null),
          channel: ownChannel && {
            id: ownChannel.id,
            name: ownChannel.name,
            handle: ownChannel.handle,
            avatar: ownChannel.avatar,
            subscribers: ownChannel.subscribers,
          },
          competitors: (suggestions ?? [])
            .filter((c) => picked.includes(c.id))
            .map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, subscribers: c.subscribers })),
          durationMs: Date.now() - startedAt.current,
        }),
      })
      if (!res.ok) throw new Error()
      track(skipped ? "onboarding_skipped" : "onboarding_completed", properties)
      router.push("/")
      router.refresh()
    } catch {
      track("onboarding_save_failed", { ...properties, skipped })
      setError(o.competitors.failed)
      setSaving(false)
    }
  }

  const stepIndex = STEPS.indexOf(step)
  const nicheLabel = niches?.find((n) => n.id === niche)?.label[locale]

  return (
    <div className="ob-glow min-h-svh bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <ReturbeMark className="size-7" />
          <span className="text-lg leading-none font-bold tracking-tight">{t.brand}</span>
        </div>

        <ol className="hidden items-center gap-2 sm:flex">
          {o.steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  i === stepIndex
                    ? "bg-brand/10 text-brand-text ring-1 ring-brand/25"
                    : i < stepIndex
                      ? "text-brand-text"
                      : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full text-[10px] font-semibold",
                    i <= stepIndex ? "bg-brand text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {i < stepIndex ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
                </span>
                {label}
              </span>
              {i < o.steps.length - 1 && <span className="h-px w-6 bg-border" />}
            </li>
          ))}
        </ol>

        <button type="button" onClick={() => finish(true)} disabled={saving} className={linkButton}>
          {o.skip}
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        {/* Step 1: who are you */}
        {step === "role" && (
          <section className="mx-auto max-w-2xl pt-8 text-center sm:pt-14">
            <p className="ob-in text-xs font-semibold tracking-[0.16em] text-brand-text uppercase">{o.stepOf(1, 3)}</p>
            <h1 className="ob-in mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ animationDelay: "60ms" }}>
              {o.role.title(t.brand)}
            </h1>
            <p className="ob-in mt-3 text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
              {o.role.subtitle}
            </p>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ROLES.map((r, i) => {
                const active = role === r.id
                const copy = o.role.options[r.id]
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    aria-pressed={active}
                    style={{ animationDelay: `${160 + i * 60}ms` }}
                    className={cn(
                      "ob-in group flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors",
                      active
                        ? "border-brand bg-brand/5 ring-1 ring-brand/20"
                        : "hover:border-brand/40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                        active ? "bg-brand text-white" : "bg-muted text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <r.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{copy.title}</span>
                      <span className="block text-xs text-muted-foreground">{copy.text}</span>
                    </span>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        active ? "border-brand bg-brand text-white" : "border-border"
                      )}
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>

            <button type="button" disabled={!role} onClick={chooseRole} className={cn(primaryButton, "mt-8")}>
              {o.continue} <ArrowRight className="size-4" />
            </button>
          </section>
        )}

        {/* Step 2: the channel, or the niche for creators starting out */}
        {step === "channel" && role && (
          <section className="mx-auto max-w-xl pt-8 text-center sm:pt-14">
            <button type="button" onClick={() => setStep("role")} className={cn(linkButton, "ob-in mb-6 inline-flex items-center gap-1.5")}>
              <ArrowLeft className="size-3.5" /> {o.back}
            </button>
            <p className="ob-in text-xs font-semibold tracking-[0.16em] text-brand-text uppercase">{o.stepOf(2, 3)}</p>
            <h1 className="ob-in mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ animationDelay: "60ms" }}>
              {noChannel ? o.channel.titles.aspiring : o.channel.titles[role]}
            </h1>
            <p className="ob-in mx-auto mt-3 max-w-md text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
              {noChannel ? o.channel.nicheSubtitle : o.channel.subtitle}
            </p>

            {error && (
              <p role="alert" className="ob-in mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            {!noChannel ? (
              <div className="ob-in mt-8" style={{ animationDelay: "160ms" }}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    searchChannel()
                  }}
                  className="flex items-center gap-2 rounded-xl border bg-card p-1.5 shadow-sm transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
                >
                  <Search className="ml-2 size-4 shrink-0 text-muted-foreground" />
                  <label htmlFor="onboarding-channel" className="sr-only">
                    {o.channel.label}
                  </label>
                  <input
                    id="onboarding-channel"
                    autoFocus
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={o.channel.placeholder}
                    className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button type="submit" disabled={!input.trim() || searching} className={cn(primaryButton, "px-4 py-2")}>
                    {searching ? <Loader2 className="size-4 animate-spin" /> : null}
                    {searching ? o.channel.searching : o.channel.search}
                  </button>
                </form>

                {channel ? (
                  <div className="ob-pop mt-5 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4 text-left">
                    <ChannelAvatar src={channel.avatar} name={channel.name} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{channel.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[
                          channel.handle,
                          channel.subscribers != null ? t.common.subscribers(compact(channel.subscribers)) : null,
                          channel.niche?.label[locale],
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {!channel.inDatabase && <p className="mt-1 text-xs text-brand-text">{o.channel.notScanned}</p>}
                    </div>
                    <Check className="size-5 shrink-0 text-brand-text" />
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="text-muted-foreground">{o.channel.tryWith}</span>
                    {EXAMPLES.map((handle) => (
                      <button
                        key={handle}
                        type="button"
                        onClick={() => searchChannel(handle)}
                        className="rounded-full border bg-card px-3 py-1 text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
                      >
                        {handle}
                      </button>
                    ))}
                  </div>
                )}

                <button type="button" disabled={!channel} onClick={goToCompetitors} className={cn(primaryButton, "mt-8")}>
                  {o.continue} <ArrowRight className="size-4" />
                </button>
              </div>
            ) : (
              <div className="ob-in mt-8" style={{ animationDelay: "160ms" }}>
                {niches ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {niches.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setNiche(n.id)}
                        aria-pressed={niche === n.id}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                          niche === n.id
                            ? "border-brand bg-brand/10 text-brand-text"
                            : "bg-card text-muted-foreground hover:border-brand/40 hover:text-foreground"
                        )}
                      >
                        {n.label[locale]}
                      </button>
                    ))}
                  </div>
                ) : (
                  !error && <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                )}
                <button type="button" disabled={!niche} onClick={goToCompetitors} className={cn(primaryButton, "mt-8")}>
                  {o.continue} <ArrowRight className="size-4" />
                </button>
              </div>
            )}

            <button type="button" onClick={toggleNoChannel} className={cn(linkButton, "ob-in mt-8 block w-full underline-offset-4 hover:underline")}>
              {noChannel ? o.channel.hasChannel : o.channel.noChannel}
            </button>
          </section>
        )}

        {/* Step 3: the channels to follow */}
        {step === "competitors" && (
          <section className="mx-auto max-w-3xl pt-8 sm:pt-14">
            <div className="text-center">
              <button type="button" onClick={() => setStep("channel")} className={cn(linkButton, "ob-in mb-6 inline-flex items-center gap-1.5")}>
                <ArrowLeft className="size-3.5" /> {o.back}
              </button>
              <p className="ob-in text-xs font-semibold tracking-[0.16em] text-brand-text uppercase">{o.stepOf(3, 3)}</p>
              <h1 className="ob-in mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl" style={{ animationDelay: "60ms" }}>
                {noChannel && nicheLabel ? o.competitors.nicheTitle(nicheLabel) : o.competitors.title}
              </h1>
              <p className="ob-in mx-auto mt-3 max-w-md text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
                {o.competitors.subtitle}
              </p>
            </div>

            {suggestions === null ? (
              <p className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> {o.competitors.loading}
              </p>
            ) : suggestions.length === 0 ? (
              <p className="mx-auto mt-10 max-w-md rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {o.competitors.empty}
              </p>
            ) : (
              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {suggestions.map((c, i) => {
                  const active = picked.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPicked((p) => (p.includes(c.id) ? p.filter((id) => id !== c.id) : [...p, c.id]))}
                      style={{ animationDelay: `${i * 50}ms` }}
                      className={cn(
                        "ob-in flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
                        active
                          ? "border-brand bg-brand/5"
                          : "hover:border-brand/40"
                      )}
                    >
                      <ChannelAvatar src={c.avatar} name={c.name} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[c.handle, c.subscribers != null ? t.common.subscribers(compact(c.subscribers)) : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                          active ? "bg-brand text-white" : "border text-muted-foreground"
                        )}
                      >
                        {active && <Check className="size-3" strokeWidth={3} />}
                        {active ? o.competitors.following : o.competitors.follow}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {error && (
              <p role="alert" className="mt-6 text-center text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="mt-10 flex justify-center">
              <button type="button" disabled={suggestions === null || saving} onClick={() => finish()} className={primaryButton}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {saving ? o.competitors.finishing : o.competitors.finish(picked.length)}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
