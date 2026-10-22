"use client";

import { useI18n } from "@/components/i18n-provider";
import { INTL_LOCALES } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A country's flag from its ISO code ("NL"), as an image: Windows draws flag
 * emojis as two letters. The country name is the tooltip and alt text.
 */
export function CountryFlag({ country, className }: { country: string | null; className?: string }) {
  const { locale } = useI18n();
  if (!country || !/^[A-Z]{2}$/i.test(country)) return null;
  const code = country.toLowerCase();
  let name = country.toUpperCase();
  try {
    name = new Intl.DisplayNames([INTL_LOCALES[locale]], { type: "region" }).of(name) ?? name;
  } catch {
    // Unknown region code: keep the code
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={name}
      title={name}
      loading="lazy"
      className={cn("inline-block h-3.5 w-auto shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]", className)}
    />
  );
}
