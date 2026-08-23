"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDownIcon, LoaderCircleIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { Button, buttonVariants } from "@/components/ui/button"
import { CommunityFrame } from "@/app/(support)/support/_components/community-frame"
import { SupportEmptyState as EmptyState } from "@/app/(support)/support/_components/support-ui"
import { newPostHref, fetchPosts, type Post } from "@/lib/api/support-community"
import { useCommunityCategoryRoute } from "@/app/(support)/support/_components/support-community-route"
import { PostCard, PostListLoading } from "@/app/(support)/support/community/posts/_components/post-ui"
import { useI18n } from "@/i18n/provider"
import { cn } from "@/lib/utils"

export function PostList() {
  const t = useI18n()
  const searchParams = useSearchParams()
  const categoryRoute = useCommunityCategoryRoute()
  const requestSeq = useRef(0)
  const [posts, setPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsFailed, setPostsFailed] = useState(false)
  const [postPage, setPostPage] = useState({ page: 1, limit: 20, total: 0 })
  const title = searchParams.get("title") || ""
  const [status, setStatus] = useState(searchParams.get("status") || "all")

  const loadPosts = useCallback((page = 1, append = false) => {
    if (categoryRoute.categorySlug && !categoryRoute.activeCategory) {
      setPosts([])
      setPostPage((current) => ({ ...current, page: 1, total: 0 }))
      setPostsLoading(categoryRoute.categoriesLoading)
      setPostsFailed(!categoryRoute.categoriesLoading)
      return
    }
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    setPostsLoading(true)
    setPostsFailed(false)
    void fetchPosts({
      categoryId: categoryRoute.activeCategoryId === "all" ? undefined : categoryRoute.activeCategoryId,
      status: status === "all" ? undefined : status,
      title,
      page,
      limit: postPage.limit,
    })
      .then((result) => {
        if (seq !== requestSeq.current) return
        setPosts((current) => append ? [...current, ...result.results] : result.results)
        setPostPage(result.page)
      })
      .catch(() => {
        if (seq !== requestSeq.current) return
        if (!append) setPosts([])
        setPostsFailed(true)
      })
      .finally(() => {
        if (seq === requestSeq.current) setPostsLoading(false)
      })
  }, [categoryRoute.activeCategory, categoryRoute.activeCategoryId, categoryRoute.categoriesLoading, categoryRoute.categorySlug, postPage.limit, status, title])

  useEffect(() => {
    const timer = window.setTimeout(() => loadPosts(1), 180)
    return () => window.clearTimeout(timer)
  }, [loadPosts])

  const hasMorePosts = posts.length < postPage.total
  const statusOptions = [
    { value: "all", label: t("supportPublic.status.all") },
    { value: "normal", label: t("supportPublic.status.normal") },
    { value: "resolved", label: t("supportPublic.status.resolved") },
  ]

  return (
    <CommunityFrame categoryRoute={categoryRoute}>
      <div className="px-5 pt-4 sm:px-6 md:px-8 lg:px-10 2xl:px-12">
        <div className="flex flex-col gap-3 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "h-8 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  status === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-pressed={status === option.value}
                onClick={() => setStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Link className={cn(buttonVariants(), "h-9 px-3")} href={newPostHref()}>{t("supportPublic.actions.createPost")}</Link>
          </div>
        </div>
      </div>
      <div className="px-5 py-3 sm:px-6 md:px-8 lg:px-10 2xl:px-12">
        {posts.length ? posts.map((item) => <PostCard key={item.id} item={item} />) : null}
        {postsLoading && !posts.length ? <PostListLoading /> : null}
        {!postsLoading && postsFailed ? (
          <div className="rounded-md border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            <div>{t("supportPublic.empty.postsFailed")}</div>
            <Button variant="destructive" size="sm" className="mt-3" onClick={() => loadPosts(1)}>
              {t("supportPublic.actions.retry")}
            </Button>
          </div>
        ) : null}
        {!postsLoading && !postsFailed && !posts.length ? <EmptyState text={t("supportPublic.empty.noPostsMatched")} /> : null}
        {hasMorePosts ? (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" disabled={postsLoading} onClick={() => loadPosts(postPage.page + 1, true)}>
              {postsLoading ? <LoaderCircleIcon className="animate-spin" /> : <ChevronDownIcon />}
              {postsLoading ? t("supportPublic.loading.posts") : t("supportPublic.actions.loadMore")}
            </Button>
          </div>
        ) : null}
      </div>
    </CommunityFrame>
  )
}
