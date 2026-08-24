"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { LoadMore } from "@/components/load-more"
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
  const title = searchParams.get("title") || ""
  const [status, setStatus] = useState(searchParams.get("status") || "all")

  const resetKey = [
    categoryRoute.activeCategoryId,
    categoryRoute.categorySlug,
    status,
    title,
  ].join(":")
  const loadPosts = useCallback(({ cursor }: { cursor: string; force: boolean }) => {
    return fetchPosts({
      categoryId: categoryRoute.activeCategoryId === "all" ? undefined : categoryRoute.activeCategoryId,
      status: status === "all" ? undefined : status,
      title,
      cursor,
      limit: 20,
    })
  }, [categoryRoute.activeCategoryId, status, title])
  const statusOptions = [
    { value: "all", label: t("supportPublic.status.all") },
    { value: "normal", label: t("supportPublic.status.normal") },
    { value: "resolved", label: t("supportPublic.status.resolved") },
  ]
  const categoryUnavailable = Boolean(categoryRoute.categorySlug && !categoryRoute.categoriesLoading && !categoryRoute.activeCategory)

  return (
    <CommunityFrame categoryRoute={categoryRoute}>
      <div className="px-4 pt-3 sm:px-5 md:px-6 lg:px-8 2xl:px-10">
        <div className="flex flex-col gap-2 border-b pb-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
            <Link className={cn(buttonVariants(), "h-8 px-3 text-xs")} href={newPostHref()}>{t("supportPublic.actions.createPost")}</Link>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 sm:px-5 md:px-6 lg:px-8 2xl:px-10">
        {categoryRoute.categoriesLoading && categoryRoute.categorySlug ? <PostListLoading compact /> : null}
        {categoryUnavailable ? <EmptyState text={t("supportPublic.empty.noPostsMatched")} /> : null}
        {!categoryRoute.categoriesLoading && !categoryUnavailable ? (
          <LoadMore<Post>
            resetKey={resetKey}
            initialHasMore
            initialLoad
            labels={{
              loadMore: t("supportPublic.actions.loadMore"),
              noMore: t("supportPublic.actions.noMore"),
              loading: t("supportPublic.loading.posts"),
              error: t("supportPublic.empty.postsFailed"),
            }}
            loadPage={loadPosts}
            renderItems={(items) => items.map((item) => <PostCard key={item.id} item={item} compact />)}
            renderEmpty={() => <EmptyState text={t("supportPublic.empty.noPostsMatched")} />}
          />
        ) : null}
      </div>
    </CommunityFrame>
  )
}
