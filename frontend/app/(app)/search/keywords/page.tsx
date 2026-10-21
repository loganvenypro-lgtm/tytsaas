import { PagePlaceholder } from "@/components/page-placeholder"

export default function KeywordsPage() {
  return (
    <PagePlaceholder
      title="Keywords"
      description="Explore une niche à partir d'un mot-clé."
      features={[
        "Recherche dans les titres de toutes les vidéos analysées.",
        "Vues moyennes, nombre de vidéos et chaînes qui dominent le sujet.",
        "Les vidéos outliers sur ce mot-clé, pour trouver les angles qui marchent.",
      ]}
      data="Index de recherche sur les titres déjà en place sur la table videos."
    />
  )
}
