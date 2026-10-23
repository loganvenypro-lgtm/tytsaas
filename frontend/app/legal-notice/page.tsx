import { LegalPage, legalMetadata } from "@/components/legal-page"

export const generateMetadata = () => legalMetadata("legal-notice")

export default function Page() {
  return <LegalPage doc="legal-notice" />
}
