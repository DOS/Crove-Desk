import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AuthProvider } from "@/components/auth-provider"
import { ConfirmProvider } from "@/components/confirm-provider"
import { ImageLightboxProvider } from "@/components/image-lightbox"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppI18nProvider } from "@/i18n/provider"

import "@/app/globals.css"
import "md-editor-rt/lib/style.css"
import "@/styles/main.scss"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: paletteScript }} />
        <AppI18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <ConfirmProvider>
                <ImageLightboxProvider>
                  <TooltipProvider>
                    {children}
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
