"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"

/** shadcn's mode toggle as a single button: each click switches light ↔ dark. */
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={t.settings.theme.title}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  )
}
