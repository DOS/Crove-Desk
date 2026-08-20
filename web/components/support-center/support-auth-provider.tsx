"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { fetchProfile, logout } from "@/lib/api/auth"
import {
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_SESSION_EXPIRED_EVENT,
  clearSession,
  readSession,
  writeSession,
  type AuthSession,
} from "@/lib/auth"

type SupportAuthContextValue = {
  session: AuthSession | null
  ready: boolean
  signingOut: boolean
  refreshSession: () => Promise<void>
  signOut: () => Promise<void>
}

const SupportAuthContext = createContext<SupportAuthContextValue | null>(null)

export function SupportAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [ready, setReady] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const refreshSession = useCallback(async () => {
    const stored = readSession()
    if (!stored) {
      setSession(null)
      setReady(true)
      return
    }

    try {
      const profile = await fetchProfile()
      const nextSession: AuthSession = {
        ...stored,
        ...profile,
        accessToken: profile.accessToken || stored.accessToken,
        expiresAt: profile.expiresAt || stored.expiresAt,
      }
      writeSession(nextSession)
      setSession(nextSession)
    } catch (error) {
      const errorCode = (error as Error & { errorCode?: number }).errorCode
      if (errorCode === 3000 || errorCode === 3002) {
        clearSession()
        setSession(null)
      } else {
        setSession(stored)
      }
    } finally {
      setReady(true)
    }
  }, [])

  const signOut = useCallback(async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await logout()
    } catch {
      clearSession()
    } finally {
      setSession(null)
      setSigningOut(false)
    }
  }, [signingOut])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  useEffect(() => {
    const syncSession = () => {
      setSession(readSession())
      setReady(true)
    }
    const syncOtherTab = (event: StorageEvent) => {
      if (event.key === "agent-desk-session") syncSession()
    }

    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncSession)
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, syncSession)
    window.addEventListener("storage", syncOtherTab)
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncSession)
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, syncSession)
      window.removeEventListener("storage", syncOtherTab)
    }
  }, [])

  return <SupportAuthContext.Provider value={{ session, ready, signingOut, refreshSession, signOut }}>{children}</SupportAuthContext.Provider>
}

export function useSupportAuth() {
  const context = useContext(SupportAuthContext)
  if (!context) throw new Error("useSupportAuth must be used within SupportAuthProvider")
  return context
}
