import { PagePlaceholder } from "@/components/page-placeholder"

export default function ConnectClaudePage() {
  return (
    <PagePlaceholder
      title="Connect Claude"
      description="Utilise tes données directement depuis Claude."
      features={[
        "Connecte Claude à ton compte via un serveur MCP.",
        "Crée et révoque tes clés d'accès.",
        "Demande à Claude d'analyser tes concurrents, tes dossiers ou une niche.",
      ]}
      data="2 clés MCP importées d'Outlr (table mcp_api_keys)."
    />
  )
}
