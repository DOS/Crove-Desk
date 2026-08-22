"use client"

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react"
import { toast } from "sonner"

import { useI18n } from "@/i18n/provider"
import { isApiRequestError } from "@/lib/api/client"

type ApiErrorHandler = (error: unknown) => void

const ApiErrorContext = createContext<ApiErrorHandler>(() => {})

export function ApiErrorProvider({ children }: { children: ReactNode }) {
  const t = useI18n()
  const handleApiError = useCallback<ApiErrorHandler>((error) => {
    const message = error instanceof Error && error.message
      ? error.message
      : t("api.requestFailed")
    toast.error(message)
  }, [t])

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isApiRequestError(event.reason)) {
        return
      }
      event.preventDefault()
      event.stopImmediatePropagation()
      handleApiError(event.reason)
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection, true)
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection, true)
  }, [handleApiError])

  return (
    <ApiErrorContext.Provider value={handleApiError}>
      {children}
    </ApiErrorContext.Provider>
  )
}

export function useApiErrorHandler() {
  return useContext(ApiErrorContext)
}
