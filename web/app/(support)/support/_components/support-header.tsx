"use client"

import { BookOpenIcon, HeadphonesIcon, HomeIcon, LoaderCircleIcon, LogOutIcon, MessageCircleQuestionIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useSupportAuth } from "@/app/(support)/support/_components/support-auth-provider"
import { useI18n } from "@/i18n/provider"
import { cn } from "@/lib/utils"

export type SupportHeaderSection = "home" | "help" | "questions" | "ask" | "login"

const sectionTitleKey: Record<SupportHeaderSection, string> = {
  home: "supportPublic.home.badge",
  help: "supportPublic.help.title",
  questions: "supportPublic.nav.questions",
  ask: "supportPublic.ask.title",
  login: "supportPublic.nav.login",
}

export function SupportHeader({
  section,
  leading,
  className,
}: {
  section: SupportHeaderSection
  leading?: ReactNode
  className?: string
}) {
  const t = useI18n()
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/support/questions" && pathname.startsWith("/support/question/")) return true
    return href === "/support" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80", className)}>
      <div className="mx-auto flex h-14 max-w-[var(--support-docs-max-width)] items-center gap-3 px-4 sm:px-6 md:px-8 xl:px-6">
        {leading}
        <Link href="/support" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <span>AGENT DESK</span>
          <span className="hidden border-l pl-2 font-normal text-muted-foreground sm:inline">{t(sectionTitleKey[section])}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1" aria-label={t("supportPublic.home.badge")}>
          <Link className={cn(buttonVariants({ variant: isActive("/support") ? "secondary" : "ghost", size: "sm" }), "hidden sm:inline-flex")} href="/support">
            <HomeIcon />{t("supportPublic.nav.home")}
          </Link>
          <Link className={cn(buttonVariants({ variant: isActive("/support/help") ? "secondary" : "ghost", size: "sm" }), "hidden sm:inline-flex")} href="/support/help">
            <BookOpenIcon />{t("supportPublic.nav.help")}
          </Link>
          <Link className={cn(buttonVariants({ variant: isActive("/support/questions") ? "secondary" : "ghost", size: "sm" }), "hidden sm:inline-flex")} href="/support/questions">
            <MessageCircleQuestionIcon />{t("supportPublic.nav.questions")}
          </Link>
          <SupportAccountControl />
        </nav>
      </div>
    </header>
  )
}

function SupportAccountControl() {
  const t = useI18n()
  const { ready, session, signingOut, signOut } = useSupportAuth()

  if (!ready) {
    return <div className="h-7 w-20 animate-pulse rounded-md bg-muted" aria-label={t("supportPublic.account.loading")} />
  }

  if (!session) {
    return (
      <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/support/login">
        <HeadphonesIcon />{t("supportPublic.nav.login")}
      </Link>
    )
  }

  const user = session.user
  const displayName = user.nickname || user.username
  const fallback = displayName.slice(0, 1).toUpperCase() || "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-w-44") } />} aria-label={t("supportPublic.account.openMenu")}>
        <Avatar size="sm">
          <AvatarImage src={user.avatar} alt={displayName} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
        <span className="max-w-24 truncate sm:max-w-32">{displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left">
              <Avatar>
                <AvatarImage src={user.avatar} alt={displayName} />
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.username}</p>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onClick={() => void signOut()} variant="destructive">
          {signingOut ? <LoaderCircleIcon className="animate-spin" /> : <LogOutIcon />}
          {signingOut ? t("supportPublic.account.signingOut") : t("supportPublic.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
