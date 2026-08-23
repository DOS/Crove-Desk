"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { fetchCategories, postHref, postsHref, type Category } from "@/lib/api/support-community"
import { fetchSupportMe } from "@/lib/api/support"
import { readSession } from "@/lib/auth"

export function useCommunityCategoryRoute() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesFailed, setCategoriesFailed] = useState(false)
  const categorySlug = categorySlugFromPath(pathname) || searchParams.get("category") || ""
  const activeCategory = categorySlug ? categories.find((item) => item.slug === categorySlug) : undefined
  const activeCategoryId: number | "all" = categorySlug ? activeCategory?.id ?? "all" : "all"

  const loadCategories = useCallback(() => {
    setCategoriesLoading(true)
    setCategoriesFailed(false)
    void fetchCategories()
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
      router.push(`${postsHref()}${query ? `?${query}` : ""}`)
      return
    }
    const category = categories.find((item) => item.id === value)
    router.push(`/support/community/categories/${encodeURIComponent(category?.slug || String(value))}${query ? `?${query}` : ""}`)
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

export function communityPostHref(id: number) {
  return postHref(id)
}

export function categorySlugFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] !== "support" || segments[1] !== "community" || segments[2] !== "categories" || segments.length !== 4) {
    return ""
  }
  return decodeURIComponent(segments[3] || "")
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
  return next?.startsWith("/support/") && !next.startsWith("/support/login") ? next : postsHref()
}
