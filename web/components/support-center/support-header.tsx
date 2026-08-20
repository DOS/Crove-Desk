"use client"

import { HeadphonesIcon, HomeIcon, MessageCircleQuestionIcon, BookOpenIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
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

  const isActive = (href: string) => href === "/support" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

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
          <Link className={buttonVariants({ variant: "outline", size: "sm" })} href="/support/login">
            <HeadphonesIcon />{t("supportPublic.nav.login")}
          </Link>
        </nav>
      </div>
    </header>
  )
}
