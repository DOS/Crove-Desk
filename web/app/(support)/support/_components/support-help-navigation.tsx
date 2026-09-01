"use client"

import { useCallback, useEffect, useState, type ComponentPropsWithoutRef, type MouseEvent as ReactMouseEvent } from "react"

import { type DocNavigationNode, type DocPage } from "@/lib/api/support"

export type DocPageNavigationHandler = (event: ReactMouseEvent<HTMLAnchorElement>, page: DocPage) => void

export function docPageHref(page: DocPage) {
  return page.docPath || "/support/docs/"
}

function docPathFromPathname(pathname: string) {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent)
  const docsIndex = parts.findIndex((part, index) => (part === "docs" || part === "help") && parts[index - 1] === "support")
  if (docsIndex < 0 || parts.length === docsIndex + 1) return ""
  return `/support/docs/${parts.slice(docsIndex + 1).map(encodeURIComponent).join("/")}/`
}

export function useSupportDocRoute(pathname: string) {
  const [activePath, setActivePath] = useState(() => docPathFromPathname(pathname))

  useEffect(() => {
    const handlePopState = () => setActivePath(docPathFromPathname(window.location.pathname))
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const replace = useCallback((page: DocPage) => {
    const target = docPageHref(page)
    window.history.replaceState(null, "", target)
    setActivePath(target)
  }, [])

  const navigate = useCallback<DocPageNavigationHandler>((event, page) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    const href = docPageHref(page)
    if (window.location.pathname !== href) {
      window.history.pushState(null, "", href)
      setActivePath(href)
    }
    window.scrollTo({ top: 0, behavior: "auto" })
  }, [])

  return { activePath, navigate, replace }
}

export function flattenSupportDocNavigation(nodes: DocNavigationNode[], parentSegments: string[] = []): DocPage[] {
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
      docPath: `/support/docs/${[...parentSegments, node.slug].map(encodeURIComponent).join("/")}/`,
    },
    ...flattenSupportDocNavigation(node.children, [...parentSegments, node.slug]),
  ])
}

export function SupportDocLink({
  page,
  onNavigate,
  onClick,
  ...props
}: Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  page: DocPage
  onNavigate: DocPageNavigationHandler
}) {
  return (
    <a
      {...props}
      href={docPageHref(page)}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) onNavigate(event, page)
      }}
    />
  )
}
