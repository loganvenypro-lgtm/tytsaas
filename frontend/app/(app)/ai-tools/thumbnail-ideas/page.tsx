import { PagePlaceholder } from "@/components/page-placeholder"

export default function ThumbnailIdeasPage() {
  return (
    <PagePlaceholder
      title="Thumbnail Ideas"
      description="Des idées de miniatures basées sur ce qui marche vraiment."
      features={[
        "Les styles de miniatures des vidéos outliers de ta niche.",
        "L'historique des A/B tests : les miniatures que les créateurs ont changées, et l'effet sur les vues.",
        "Des propositions de concepts pour ta prochaine vidéo.",
      ]}
      data="26 281 variantes de titres et miniatures déjà en base (table video_variants)."
    />
  )
}
