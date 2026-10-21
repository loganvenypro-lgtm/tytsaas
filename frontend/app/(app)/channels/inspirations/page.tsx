import { PagePlaceholder } from "@/components/page-placeholder"

export default function InspirationsPage() {
  return (
    <PagePlaceholder
      title="Inspirations"
      description="Les chaînes que tu suis pour t'en inspirer."
      features={[
        "Suivre une chaîne et recevoir ses vidéos qui surperforment.",
        "Tags et notes pour organiser tes inspirations.",
        "Alertes quand une chaîne suivie sort un outlier.",
      ]}
      data="46 chaînes suivies importées d'Outlr (table tracked_channels)."
    />
  )
}
