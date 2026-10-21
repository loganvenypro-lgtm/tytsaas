"use client"

import * as React from "react"

import { createFormatters, getMessages, type Formatters, type Locale, type Messages } from "@/lib/i18n"

type I18n = Formatters & { locale: Locale; t: Messages }

const I18nContext = React.createContext<I18n | null>(null)

/** Gives client components the strings of the language read from the cookie by the root layout. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ locale, t: getMessages(locale), ...createFormatters(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const value = React.useContext(I18nContext)
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>")
  return value
}
