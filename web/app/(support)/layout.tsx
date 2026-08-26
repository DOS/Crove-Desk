import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import { ImageLightboxProvider } from "@/components/image-lightbox"
import { ConfirmProvider } from "@/components/confirm-provider"
import { SupportAuthProvider } from "@/components/support-center/support-auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppI18nProvider } from "@/i18n/provider"

import "./support.css"
import "md-editor-rt/lib/style.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Crove Desk Support",
  description: "Crove Desk Support Center",
}

export default function SupportRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-US" className={`${inter.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body
        className="antialiased font-sans"
      >
        <AppI18nProvider>
          <ThemeProvider>
            <SupportAuthProvider>
              <ConfirmProvider>
                <ImageLightboxProvider>
                  <TooltipProvider>
                    {children}
                    <Toaster position="top-center" richColors />
                  </TooltipProvider>
                </ImageLightboxProvider>
              </ConfirmProvider>
            </SupportAuthProvider>
          </ThemeProvider>
        </AppI18nProvider>
      </body>
    </html>
  )
}
