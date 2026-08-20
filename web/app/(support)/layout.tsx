import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { ImageLightboxProvider } from "@/components/image-lightbox"
import { SupportAuthProvider } from "@/components/support-center/support-auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AppI18nProvider } from "@/i18n/provider"

import "./support.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "AgentDesk Support",
  description: "AgentDesk Support Center",
}

export default function SupportRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-US" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppI18nProvider>
          <ThemeProvider>
            <SupportAuthProvider>
              <ImageLightboxProvider>
                <TooltipProvider>
                  {children}
                  <Toaster position="top-center" richColors />
                </TooltipProvider>
              </ImageLightboxProvider>
            </SupportAuthProvider>
          </ThemeProvider>
        </AppI18nProvider>
      </body>
    </html>
  )
}
