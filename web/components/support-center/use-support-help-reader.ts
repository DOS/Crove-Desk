"use client"

import { useEffect, useRef, useState } from "react"

import { fetchSupportHelpNavigation, fetchSupportHelpPage, type SupportHelpNavigationNode, type SupportHelpPage } from "@/lib/api/support"

export function useSupportHelpReader(activeSlug: string, onDefaultSlug: (slug: string) => void) {
  const [page, setPage] = useState<SupportHelpPage | null>(null)
  const [pages, setPages] = useState<SupportHelpPage[]>([])
  const [navigationLoading, setNavigationLoading] = useState(true)
  const [loadedSlug, setLoadedSlug] = useState("")
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const initialSlug = useRef(activeSlug)
  const detailCache = useRef(new Map<string, SupportHelpPage>())
  const detailRequestId = useRef(0)
  const expandedInitialized = useRef(false)

  useEffect(() => {
    void fetchSupportHelpNavigation()
      .then((tree) => {
        setFailed(false)
        const navigationPages = flattenHelpNavigation(tree)
        setPages(navigationPages)
        const target = initialSlug.current || navigationPages[0]?.slug || String(navigationPages[0]?.id || "")
        if (!target) {
          setPage(null)
          setExpanded(new Set())
          return
        }
        if (!initialSlug.current) onDefaultSlug(target)
      })
      .catch(() => {
        setPage(null)
        setFailed(true)
      })
      .finally(() => setNavigationLoading(false))
  }, [onDefaultSlug])

  useEffect(() => {
    if (!activeSlug || !pages.length) return
    const requestId = ++detailRequestId.current
    const cached = detailCache.current.get(activeSlug)
    const detailRequest = cached ? Promise.resolve(cached) : fetchSupportHelpPage(activeSlug)
    void detailRequest
      .then((detail) => {
        if (requestId !== detailRequestId.current) return
        detailCache.current.set(activeSlug, detail)
        if (detail.slug) detailCache.current.set(detail.slug, detail)
        detailCache.current.set(String(detail.id), detail)
        setFailed(false)
        setPage(detail)
        setLoadedSlug(activeSlug)
        const activePath = [...helpPageAncestorIds(pages, detail.id), detail.id]
        setExpanded((current) => {
          if (!expandedInitialized.current) {
            expandedInitialized.current = true
            return new Set(activePath)
          }
          const next = new Set(current)
          activePath.forEach((id) => next.add(id))
          return next
        })
      })
      .catch(() => {
        if (requestId !== detailRequestId.current) return
        setPage(null)
        setFailed(true)
        setLoadedSlug(activeSlug)
      })
  }, [activeSlug, pages])

  return {
    page,
    pages,
    expanded,
    setExpanded,
    navigationLoading,
    pageLoading: navigationLoading || Boolean(activeSlug && loadedSlug !== activeSlug),
    failed,
  }
}

function flattenHelpNavigation(nodes: SupportHelpNavigationNode[]): SupportHelpPage[] {
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
    },
    ...flattenHelpNavigation(node.children),
  ])
}

function helpPageAncestorIds(pages: SupportHelpPage[], pageId: number) {
  const ancestors: number[] = []
  const pagesById = new Map(pages.map((item) => [item.id, item]))
  const visited = new Set<number>()
  let parentId = pagesById.get(pageId)?.parentId ?? 0
  while (parentId && !visited.has(parentId)) {
    ancestors.push(parentId)
    visited.add(parentId)
    parentId = pagesById.get(parentId)?.parentId ?? 0
  }
  return ancestors
}
