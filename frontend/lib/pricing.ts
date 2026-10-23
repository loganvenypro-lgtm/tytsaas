// Plans shown on /pricing. Prices are in CURRENCY, per month; the yearly price
// is YEARLY_MONTHS months for twelve.

export const CURRENCY = "EUR"
export const YEARLY_MONTHS = 10

export type PlanId = "starter" | "pro" | "team"
export type BillingPeriod = "monthly" | "yearly"

export const PLANS: { id: PlanId; monthly: number; teamSize?: number }[] = [
  { id: "starter", monthly: 25 },
  { id: "pro", monthly: 34.99 },
  { id: "team", monthly: 87.99, teamSize: 10 },
]

const cents = (n: number) => Math.round(n * 100) / 100

/** What a year costs on each period. */
export const yearlyPrice = (monthly: number, period: BillingPeriod) =>
  cents(monthly * (period === "monthly" ? 12 : YEARLY_MONTHS))

/** What the user pays per month on each period (yearly is billed once a year). */
export const monthlyPrice = (monthly: number, period: BillingPeriod) =>
  period === "monthly" ? monthly : cents(yearlyPrice(monthly, period) / 12)

/** How much a year costs less when paid yearly. */
export const yearlySaving = (monthly: number) => cents(monthly * (12 - YEARLY_MONTHS))

const SUPPORT_URL = "https://discord.gg/4cUtY3H3w"

// Hosted checkout pages (Stripe Payment Links or similar), set in .env.local.
// Next only inlines NEXT_PUBLIC_* variables named in full, hence the table.
const CHECKOUT_URLS: Record<PlanId, Record<BillingPeriod, string | undefined>> = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_CHECKOUT_STARTER_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_CHECKOUT_STARTER_YEARLY,
  },
  pro: {
    monthly: process.env.NEXT_PUBLIC_CHECKOUT_PRO_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_CHECKOUT_PRO_YEARLY,
  },
  team: {
    monthly: process.env.NEXT_PUBLIC_CHECKOUT_TEAM_MONTHLY,
    yearly: process.env.NEXT_PUBLIC_CHECKOUT_TEAM_YEARLY,
  },
}

/** The checkout page of a plan; until one is configured, the support Discord to subscribe by hand. */
export const checkoutUrl = (plan: PlanId, period: BillingPeriod) => CHECKOUT_URLS[plan][period] || SUPPORT_URL
