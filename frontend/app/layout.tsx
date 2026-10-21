import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { I18nProvider } from "@/components/i18n-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getLocale } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
    >
      <body>
        <I18nProvider locale={locale}>
          <ThemeProvider>
            {/* Mounted once at the root so notifications survive page changes */}
            <Toaster>
              <TooltipProvider>{children}</TooltipProvider>
            </Toaster>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
