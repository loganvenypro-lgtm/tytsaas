import { CheckCircle2, Database, Hammer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * A sidebar page whose feature isn't built yet: what it's for, what it will do,
 * and which data already in the database will feed it.
 */
export function PagePlaceholder({
  title,
  description,
  features,
  data,
}: {
  title: string
  description: string
  features: string[]
  data?: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <Badge variant="outline">
            <Hammer />
            En construction
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ce que cette page va faire</CardTitle>
          <CardDescription>Le contenu arrive avec le backend de cette fonctionnalité.</CardDescription>
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
