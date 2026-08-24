import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import { AuthProvider } from "@/components/auth-provider"
import { ApiErrorProvider } from "@/components/api-error-provider"
import { ConfirmProvider } from "@/components/confirm-provider"
import { ImageLightboxProvider } from "@/components/image-lightbox"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppI18nProvider } from "@/i18n/provider"

import "./dashboard.css"
import "md-editor-rt/lib/style.css"
import "@/styles/main.scss"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const paletteScript = `
try {
  var palette = window.localStorage.getItem("dashboard_palette");
  document.documentElement.dataset.palette = palette === "plain" || palette === "blue" || palette === "green" || palette === "gray" ? palette : "plain";
} catch (_) {
  document.documentElement.dataset.palette = "plain";
}
`

export const metadata: Metadata = {
  title: "AI Customer Service Admin",
  description: "AI Customer Service Admin",
}

export default function DashboardRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: paletteScript }} />
        <AppI18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <ConfirmProvider>
                <ImageLightboxProvider>
                  <TooltipProvider>
                    <ApiErrorProvider>{children}</ApiErrorProvider>
                    <Toaster position="top-center" richColors />
                  </TooltipProvider>
                </ImageLightboxProvider>
              </ConfirmProvider>
            </AuthProvider>
          </ThemeProvider>
        </AppI18nProvider>
      </body>
    </html>
  )
}
