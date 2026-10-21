import { PagePlaceholder } from "@/components/page-placeholder"

export default function StudioPage() {
  return (
    <PagePlaceholder
      title="Studio"
      description="L'espace de travail pour préparer ta prochaine vidéo."
      features={[
        "Partir d'une idée ou d'une vidéo outlier comme référence.",
        "Enchaîner titre, miniature et script au même endroit.",
        "Garder un historique de tes projets de vidéos.",
      ]}
    />
  )
}
