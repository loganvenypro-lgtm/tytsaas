import { PagePlaceholder } from "@/components/page-placeholder"

export default function CompetitorsPage() {
  return (
    <PagePlaceholder
      title="Competitors"
      description="Les chaînes de ta niche avec lesquelles tu es en concurrence."
      features={[
        "Tes concurrents choisis, avec leurs dernières vidéos et leurs outliers.",
        "Chaînes similaires suggérées à partir de ta chaîne.",
        "Comparaison côte à côte : abonnés, vues, rythme de publication.",
      ]}
      data="Concurrents choisis à l'onboarding déjà enregistrés sur chaque compte."
    />
  )
}
