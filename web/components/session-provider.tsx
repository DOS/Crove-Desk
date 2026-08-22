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

type SessionContextValue = {
  session: AuthSession | null
  ready: boolean
  signingOut: boolean
  refreshSession: () => Promise<void>
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
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
        user: profile.user,
        permissions: profile.permissions,
        roles: profile.roles,
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

  return (
    <SessionContext.Provider value={{ session, ready, signingOut, refreshSession, signOut }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error("useSession must be used within SessionProvider")
  return context
}
