"use client"

import { useEffect, useRef, useState } from "react"

import { flattenSupportHelpNavigation } from "@/app/(support)/support/_components/support-help-navigation"
import { fetchSupportHelpNavigation, fetchSupportHelpPage, type SupportHelpPage } from "@/lib/api/support"

export function useSupportHelpReader(activePath: string, onDefaultPage: (page: SupportHelpPage) => void) {
  const [page, setPage] = useState<SupportHelpPage | null>(null)
  const [pages, setPages] = useState<SupportHelpPage[]>([])
  const [navigationLoading, setNavigationLoading] = useState(true)
  const [loadedSlug, setLoadedSlug] = useState("")
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const initialPath = useRef(activePath)
  const detailCache = useRef(new Map<number, SupportHelpPage>())
  const detailRequestId = useRef(0)
  const expandedInitialized = useRef(false)

  useEffect(() => {
    void fetchSupportHelpNavigation()
      .then((tree) => {
        setFailed(false)
        const navigationPages = flattenSupportHelpNavigation(tree)
        setPages(navigationPages)
        const target = navigationPages.find((item) => item.helpPath === initialPath.current) || navigationPages[0]
        if (!target) {
          setPage(null)
          setExpanded(new Set())
          return
        }
        if (!initialPath.current) onDefaultPage(target)
      })
      .catch(() => {
        setPage(null)
        setFailed(true)
      })
      .finally(() => setNavigationLoading(false))
  }, [onDefaultPage])

  useEffect(() => {
    if (!pages.length) return
    const activePage = pages.find((item) => item.helpPath === activePath)
    if (!activePage) {
      void Promise.resolve().then(() => {
        setPage(null)
        setFailed(Boolean(activePath))
      })
      return
    }
    const requestId = ++detailRequestId.current
    const cached = detailCache.current.get(activePage.id)
    const detailRequest = cached ? Promise.resolve(cached) : fetchSupportHelpPage(activePage.id)
    void detailRequest
      .then((detail) => {
        if (requestId !== detailRequestId.current) return
        detailCache.current.set(detail.id, detail)
        setFailed(false)
        setPage({ ...detail, helpPath: activePage.helpPath })
        setLoadedSlug(activePath)
        const activePagePath = [...helpPageAncestorIds(pages, detail.id), detail.id]
        setExpanded((current) => {
          if (!expandedInitialized.current) {
            expandedInitialized.current = true
            return new Set(activePagePath)
          }
          const next = new Set(current)
          activePagePath.forEach((id) => next.add(id))
          return next
        })
      })
      .catch(() => {
        if (requestId !== detailRequestId.current) return
        setPage(null)
        setFailed(true)
        setLoadedSlug(activePath)
      })
  }, [activePath, pages])

  return {
    page,
    pages,
    expanded,
    setExpanded,
    navigationLoading,
    pageLoading: navigationLoading || Boolean(activePath && loadedSlug !== activePath),
    failed,
  }
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
