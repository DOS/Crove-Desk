"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, type ReactNode } from "react"
import { MailIcon, PencilIcon, UserRoundIcon } from "lucide-react"

import { useSupportAuth } from "@/app/(support)/support/_components/support-auth-provider"
import { SupportPageContent, SupportPageShell } from "@/app/(support)/support/_components/support-page-shell"
import { SupportEmptyState } from "@/app/(support)/support/_components/support-ui"
import { PostCard, PostListLoading } from "@/app/(support)/support/community/posts/_components/post-ui"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { LoadMore } from "@/components/load-more"
import { useI18n } from "@/i18n/provider"
import { fetchPosts, type Post } from "@/lib/api/support-community"
import { cn } from "@/lib/utils"

export function SupportProfilePage() {
  const t = useI18n()
  const router = useRouter()
  const { ready, session } = useSupportAuth()

  useEffect(() => {
    if (ready && !session) {
      router.replace("/support/login?next=/support/profile")
    }
  }, [ready, router, session])

  if (!ready || !session) {
    return (
      <SupportPageShell section="community">
        <SupportPageContent className="py-8">
          <PostListLoading />
        </SupportPageContent>
      </SupportPageShell>
    )
  }

  const user = session.user
  const displayName = user.nickname || user.username
  const fallback = displayName.slice(0, 1).toUpperCase() || "U"

  return (
    <SupportPageShell section="community">
      <SupportPageContent className="py-6 sm:py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <aside className="h-fit rounded-md border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                <AvatarImage src={user.avatar} alt={displayName} />
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold">{displayName}</h1>
                <p className="truncate text-sm text-muted-foreground">{user.username}</p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 text-sm">
              <ProfileMeta icon={<UserRoundIcon className="size-4" />} label={t("supportPublic.profile.username")} value={user.username} />
              <ProfileMeta icon={<MailIcon className="size-4" />} label={t("supportPublic.profile.email")} value={user.email || t("supportPublic.profile.emailUnset")} />
            </dl>
            <Link className={cn(buttonVariants(), "mt-5 w-full")} href="/support/profile/edit">
              <PencilIcon />
              {t("supportPublic.profile.edit")}
            </Link>
          </aside>
          <section className="min-w-0 rounded-md border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="text-base font-semibold">{t("supportPublic.profile.communityTitle")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("supportPublic.profile.communityDescription")}</p>
            </div>
            <div className="px-5 py-3">
              <MyPostList userId={user.id} />
            </div>
          </section>
        </div>
      </SupportPageContent>
    </SupportPageShell>
  )
}

function ProfileMeta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md bg-muted/45 px-3 py-2">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-right font-medium">{value}</dd>
    </div>
  )
}

function MyPostList({ userId }: { userId: number }) {
  const t = useI18n()
  const loadPosts = useCallback(({ cursor }: { cursor: string; force: boolean }) => {
    return fetchPosts({ cursor, limit: 10, userId })
  }, [userId])

  return (
    <LoadMore<Post>
      resetKey={`profile:${userId}`}
      initialHasMore
      initialLoad
      labels={{
        loadMore: t("supportPublic.actions.loadMore"),
        noMore: t("supportPublic.actions.noMore"),
        loading: t("supportPublic.loading.posts"),
        error: t("supportPublic.empty.postsFailed"),
      }}
      loadPage={loadPosts}
      renderItems={(items) => items.map((item) => <PostCard key={item.id} item={item} />)}
      renderEmpty={() => <SupportEmptyState compact text={t("supportPublic.profile.noPosts")} />}
    />
  )
}
