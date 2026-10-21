export { cn } from "cn"

export function formatCompactNumber(number?: number | null): string {
  if (number === undefined || number === null || isNaN(number)) return "0"
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(number)
}
