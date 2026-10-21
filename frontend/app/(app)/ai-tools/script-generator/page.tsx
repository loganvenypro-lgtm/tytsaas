import { PagePlaceholder } from "@/components/page-placeholder"

export default function ScriptGeneratorPage() {
  return (
    <PagePlaceholder
      title="Script Generator"
      description="Génère un script de vidéo avec l'IA."
      features={[
        "Un script à partir d'un sujet, d'un ton et d'une durée cible.",
        "Inspiré des vidéos qui ont le mieux marché dans ta niche.",
        "Hook, structure et appel à l'action modifiables avant export.",
      ]}
    />
  )
}
