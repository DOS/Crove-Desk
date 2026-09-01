"use client"

import { useEffect, useRef, useState } from "react"

import { flattenSupportDocNavigation } from "@/app/(support)/support/_components/support-help-navigation"
import { fetchDocNavigation, fetchDocPage, type DocPage } from "@/lib/api/support"

export function useSupportDocReader(activePath: string, onDefaultPage: (page: DocPage) => void) {
  const [page, setPage] = useState<DocPage | null>(null)
  const [pages, setPages] = useState<DocPage[]>([])
  const [navigationLoading, setNavigationLoading] = useState(true)
  const [loadedSlug, setLoadedSlug] = useState("")
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const initialPath = useRef(activePath)
  const detailCache = useRef(new Map<number, DocPage>())
  const detailRequestId = useRef(0)
  const expandedInitialized = useRef(false)

  useEffect(() => {
    void fetchDocNavigation()
      .then((tree) => {
        setFailed(false)
        const navigationPages = flattenSupportDocNavigation(tree)
        setPages(navigationPages)
        const target = navigationPages.find((item) => item.docPath === initialPath.current) || navigationPages[0]
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
    const activePage = pages.find((item) => item.docPath === activePath)
    if (!activePage) {
      void Promise.resolve().then(() => {
        setPage(null)
        setFailed(Boolean(activePath))
      })
      return
    }
    const requestId = ++detailRequestId.current
    const cached = detailCache.current.get(activePage.id)
    const detailRequest = cached ? Promise.resolve(cached) : fetchDocPage(activePage.id)
    void detailRequest
      .then((detail) => {
        if (requestId !== detailRequestId.current) return
        detailCache.current.set(detail.id, detail)
        setFailed(false)
        setPage({ ...detail, docPath: activePage.docPath })
        setLoadedSlug(activePath)
        const activePagePath = [...docPageAncestorIds(pages, detail.id), detail.id]
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

function docPageAncestorIds(pages: DocPage[], pageId: number) {
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
