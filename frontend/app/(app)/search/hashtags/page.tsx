import { PagePlaceholder } from "@/components/page-placeholder"

export default function HashtagsPage() {
  return (
    <PagePlaceholder
      title="Hashtags"
      description="Les hashtags qui accompagnent les vidéos qui performent."
      features={[
        "Hashtags les plus utilisés par les vidéos outliers.",
        "Évolution de leur usage dans le temps.",
        "Toutes les vidéos d'un hashtag, triées par performance.",
      ]}
    />
  )
}
