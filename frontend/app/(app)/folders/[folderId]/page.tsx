import { FolderDetailView } from "@/components/folders/folder-detail-view"

export default async function FolderPage({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params
  return <FolderDetailView folderId={folderId} />
}
