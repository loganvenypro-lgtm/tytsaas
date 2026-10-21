import { CheckCircle2, Database, Hammer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Messages } from "@/lib/i18n"
import { getT } from "@/lib/i18n/server"

// Each placeholder page is named like its sidebar entry (t.nav.items) and described in t.placeholder.pages
export type PlaceholderPage = keyof Messages["placeholder"]["pages"] & keyof Messages["nav"]["items"]

/**
 * A sidebar page whose feature isn't built yet: what it's for, what it will do,
 * and which data already in the database will feed it.
 */
export async function PagePlaceholder({ page }: { page: PlaceholderPage }) {
  const t = await getT()
  const { description, features, data } = t.placeholder.pages[page]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{t.nav.items[page]}</h2>
          <Badge variant="outline">
            <Hammer />
            {t.placeholder.badge}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.placeholder.title}</CardTitle>
          <CardDescription>{t.placeholder.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2">
            {features.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                {feature}
              </li>
            ))}
          </ul>
          {data && (
            <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <Database className="size-3.5 shrink-0" />
              {data}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
