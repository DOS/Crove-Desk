"use client"

import { useCallback, useEffect, useState, type ComponentPropsWithoutRef, type MouseEvent as ReactMouseEvent } from "react"

import { type SupportHelpPage } from "@/lib/api/support"

export type HelpPageNavigationHandler = (event: ReactMouseEvent<HTMLAnchorElement>, page: SupportHelpPage) => void

export function supportHelpPageHref(slugOrId: string | number) {
  return `/support/help/${encodeURIComponent(String(slugOrId))}/`
}

function helpSlugFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean)
  const helpIndex = parts.findIndex((part, index) => part === "help" && parts[index - 1] === "support")
  return helpIndex >= 0 ? decodeURIComponent(parts[helpIndex + 1] || "") : ""
}

export function useSupportHelpRoute(pathname: string) {
  const [activeSlug, setActiveSlug] = useState(() => helpSlugFromPathname(pathname))

  useEffect(() => {
    const handlePopState = () => setActiveSlug(helpSlugFromPathname(window.location.pathname))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const replace = useCallback((slugOrId: string | number) => {
    const target = String(slugOrId)
    window.history.replaceState(null, "", supportHelpPageHref(target))
    setActiveSlug(target)
  }, [])

  const navigate = useCallback<HelpPageNavigationHandler>((event, page) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const target = page.slug || String(page.id)
    const href = supportHelpPageHref(target)
    if (window.location.pathname !== href) {
      window.history.pushState(null, "", href)
      setActiveSlug(target)
    }
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [])

  return { activeSlug, navigate, replace }
}

export function SupportHelpLink({
  page,
  onNavigate,
  onClick,
  ...props
}: Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  page: SupportHelpPage
  onNavigate: HelpPageNavigationHandler
}) {
  return (
    <a
      {...props}
      href={supportHelpPageHref(page.slug || page.id)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onNavigate(event, page)
      }}
    />
  )
}
