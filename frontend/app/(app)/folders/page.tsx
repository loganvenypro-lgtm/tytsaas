import { PagePlaceholder } from "@/components/page-placeholder"

export default function FoldersPage() {
  return (
    <PagePlaceholder
      title="My Folders"
      description="Tes vidéos et chaînes enregistrées, rangées en dossiers."
      features={[
        "Créer, renommer et supprimer des dossiers.",
        "Enregistrer une vidéo ou une chaîne depuis n'importe quelle page.",
        "Retrouver les stats à jour de chaque élément enregistré.",
      ]}
      data="5 dossiers et 7 éléments importés d'Outlr (tables saved_folders et saved_folder_items)."
    />
  )
}
