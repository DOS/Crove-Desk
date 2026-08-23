"use client"

import { useCallback, useEffect, useState, type ComponentPropsWithoutRef, type MouseEvent as ReactMouseEvent } from "react"

import { type SupportHelpNavigationNode, type SupportHelpPage } from "@/lib/api/support"

export type HelpPageNavigationHandler = (event: ReactMouseEvent<HTMLAnchorElement>, page: SupportHelpPage) => void

export function supportHelpPageHref(page: SupportHelpPage) {
  return page.helpPath || "/support/help/"
}

function helpPathFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent)
  const helpIndex = parts.findIndex((part, index) => part === "help" && parts[index - 1] === "support")
  if (helpIndex < 0 || parts.length === helpIndex + 1) return ""
  return `/support/help/${parts.slice(helpIndex + 1).map(encodeURIComponent).join("/")}/`
}

export function useSupportHelpRoute(pathname: string) {
  const [activePath, setActivePath] = useState(() => helpPathFromPathname(pathname))

  useEffect(() => {
    const handlePopState = () => setActivePath(helpPathFromPathname(window.location.pathname))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const replace = useCallback((page: SupportHelpPage) => {
    const target = supportHelpPageHref(page)
    window.history.replaceState(null, "", target)
    setActivePath(target)
  }, [])

  const navigate = useCallback<HelpPageNavigationHandler>((event, page) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const href = supportHelpPageHref(page)
    if (window.location.pathname !== href) {
      window.history.pushState(null, "", href)
      setActivePath(href)
    }
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [])

  return { activePath, navigate, replace }
}

export function flattenSupportHelpNavigation(nodes: SupportHelpNavigationNode[], parentSegments: string[] = []): SupportHelpPage[] {
  return nodes.flatMap((node) => [
    {
      ...node,
      summary: "",
      contentType: "",
      content: "",
      coverUrl: "",
      tags: [],
      status: "published",
      viewCount: 0,
      helpfulCount: 0,
      unhelpfulCount: 0,
      publishedAt: "",
      createdAt: "",
      updatedAt: "",
      helpPath: `/support/help/${[...parentSegments, node.slug].map(encodeURIComponent).join("/")}/`,
    },
    ...flattenSupportHelpNavigation(node.children, [...parentSegments, node.slug]),
  ])
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
      href={supportHelpPageHref(page)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onNavigate(event, page)
      }}
    />
  )
}
