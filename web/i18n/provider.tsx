"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  DEFAULT_LOCALE,
  type AppLocale,
  configureLocale,
} from "@/i18n/config"
import { translateMessage } from "@/i18n/messages"
import { fetchPublicConfig } from "@/lib/api/config"

type LocaleContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  t: (key: string, values?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
})

export function AppI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE)
  const [isLocaleReady, setIsLocaleReady] = useState(false)

  const handleSetLocale = (newLocale: AppLocale) => {
    const next = configureLocale(newLocale)
    setLocaleState(next)
    try {
      window.localStorage.setItem("app_locale", next)
    } catch (_) {}
    document.documentElement.lang = next
    document.title = translateMessage(next, "app.metadataTitle")
  }

  useEffect(() => {
    let cancelled = false
    let savedLocale: string | null = null
    try {
      savedLocale = window.localStorage.getItem("app_locale")
    } catch (_) {}

    if (savedLocale) {
      const configured = configureLocale(savedLocale)
      setLocaleState(configured)
      document.documentElement.lang = configured
      document.title = translateMessage(configured, "app.metadataTitle")
      setIsLocaleReady(true)
      return
    }

    fetchPublicConfig()
      .then((config) => configureLocale(config.language))
      .catch(() => configureLocale(DEFAULT_LOCALE))
      .then((configuredLocale) => {
        if (cancelled) {
          return
        }
        setLocaleState(configuredLocale)
        document.documentElement.lang = configuredLocale
        document.title = translateMessage(configuredLocale, "app.metadataTitle")
        setIsLocaleReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.title = translateMessage(locale, "app.metadataTitle")
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: (key, values) => translateMessage(locale, key, values),
      setLocale: handleSetLocale,
    }),
    [locale]
  )

  if (!isLocaleReady) {
    return null
  }

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useAppLocale() {
  return useContext(LocaleContext)
}

export function useI18n() {
  return useContext(LocaleContext).t
}
