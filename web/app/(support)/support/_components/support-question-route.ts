"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { fetchSupportMe, fetchSupportQuestionCategories, type SupportCategory } from "@/lib/api/support"
import { readSession } from "@/lib/auth"

export function useSupportQuestionCategoryRoute() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<SupportCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesFailed, setCategoriesFailed] = useState(false)
  const categorySlug = questionCategorySlugFromPath(pathname) || searchParams.get("category") || ""
  const activeCategory = categorySlug ? categories.find((item) => item.slug === categorySlug) : undefined
  const activeCategoryId: number | "all" = categorySlug ? activeCategory?.id ?? "all" : "all"

  const loadCategories = useCallback(() => {
    setCategoriesLoading(true)
    setCategoriesFailed(false)
    void fetchSupportQuestionCategories()
      .then(setCategories)
      .catch(() => {
        setCategories([])
        setCategoriesFailed(true)
      })
      .finally(() => setCategoriesLoading(false))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadCategories, 0)
    return () => window.clearTimeout(timer)
  }, [loadCategories])

  const changeCategory = useCallback((value: number | "all") => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("category")
    const query = params.toString()
    if (value === "all") {
      router.push(`/support/questions${query ? `?${query}` : ""}`)
      return
    }
    const category = categories.find((item) => item.id === value)
    router.push(`/support/questions/${encodeURIComponent(category?.slug || String(value))}${query ? `?${query}` : ""}`)
  }, [categories, router, searchParams])

  return {
    activeCategory,
    activeCategoryId,
    categories,
    categoriesFailed,
    categoriesLoading,
    categorySlug,
    changeCategory,
    loadCategories,
  }
}

export function supportQuestionHref(id: number) {
  return `/support/question/${id}`
}

export function questionCategorySlugFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] !== "support" || segments[1] !== "questions" || segments.length !== 3) {
    return ""
  }
  const slug = segments[2]
  return slug && slug !== "ask" && slug !== "detail" ? decodeURIComponent(slug) : ""
}

export async function ensureSupportLogin() {
  if (!readSession()?.accessToken) {
    window.location.assign(`/support/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    throw new Error("login required")
  }
  try {
    await fetchSupportMe()
  } catch (error) {
    window.location.assign(`/support/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
    throw error
  }
}

export function getSupportLoginDestination(next: string | null) {
  return next?.startsWith("/support/") && !next.startsWith("/support/login") ? next : "/support/questions"
}
