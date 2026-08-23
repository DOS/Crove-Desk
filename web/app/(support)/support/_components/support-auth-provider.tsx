"use client"

import { createContext, useContext, type ReactNode } from "react"

import { SessionProvider, useSession } from "@/components/session-provider"
import { type AuthSession } from "@/lib/auth"

type SupportAuthContextValue = {
  session: AuthSession | null
  ready: boolean
  signingOut: boolean
  refreshSession: () => Promise<void>
  signOut: () => Promise<void>
}

const SupportAuthContext = createContext<SupportAuthContextValue | null>(null)

export function SupportAuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SupportSessionProvider>{children}</SupportSessionProvider>
    </SessionProvider>
  )
}

function SupportSessionProvider({ children }: { children: ReactNode }) {
  const { session, ready, signingOut, refreshSession, signOut } = useSession()
  return <SupportAuthContext.Provider value={{ session, ready, signingOut, refreshSession, signOut }}>{children}</SupportAuthContext.Provider>
}

export function useSupportAuth() {
  const context = useContext(SupportAuthContext)
  if (!context) throw new Error("useSupportAuth must be used within SupportAuthProvider")
  return context
}
