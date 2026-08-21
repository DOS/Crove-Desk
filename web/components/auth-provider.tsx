"use client"

import {
  createContext,
  startTransition,
  useContext,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"

import { SessionProvider, useSession } from "@/components/session-provider"
import { type AuthSession } from "@/lib/auth"

type AuthContextValue = {
  session: AuthSession | null
  ready: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <DashboardAuthProvider>{children}</DashboardAuthProvider>
    </SessionProvider>
  )
}

function DashboardAuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { session, ready, refreshSession, signOut: endSession } = useSession()
  const isDashboardLoginRoute = pathname?.startsWith("/dashboard/login") ?? false
  const requiresAuth =
    ((pathname?.startsWith("/dashboard") ?? false) ||
      (pathname?.startsWith("/workbench") ?? false)) &&
    !isDashboardLoginRoute

  const refreshProfile = useCallback(() => refreshSession(), [refreshSession])

  async function signOut() {
    try {
      await endSession()
    } finally {
      startTransition(() => {
        router.replace("/dashboard/login")
      })
    }
  }

  useEffect(() => {
    if (ready && !session && requiresAuth) {
      startTransition(() => {
        router.replace("/dashboard/login")
      })
    }
  }, [ready, requiresAuth, router, session])

  return (
    <AuthContext.Provider value={{ session, ready, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
