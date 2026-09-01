"use client"

import {
  ChevronDownIcon,
  LoaderCircleIcon,
  LogOutIcon,
  PencilIcon,
  UserRoundIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState, type ReactNode } from "react"

import { useSupportAuth } from "@/app/(support)/support/_components/support-auth-provider"
import { SupportMobileMenu } from "@/app/(support)/support/_components/support-mobile-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/i18n/provider"
import { fetchSupportConfig, type SupportNavigationMenuItem } from "@/lib/api/support-config"
import { fetchPublicConfig } from "@/lib/api/config"
import { cn } from "@/lib/utils"

export type SupportHeaderSection = "home" | "help" | "community" | "login"

const sectionTitleKey: Record<SupportHeaderSection, string> = {
  home: "supportPublic.home.badge",
  help: "supportPublic.help.title",
  community: "supportPublic.nav.community",
  login: "supportPublic.nav.login",
}

const supportNavItemClass = "h-8 rounded-md px-2.5 text-sm"

function defaultSupportNavigationMenu(t: ReturnType<typeof useI18n>): SupportNavigationMenuItem[] {
  return [
    { id: "home", title: t("supportPublic.nav.home"), url: "/support", openInNewWindow: false, visible: true, sortNo: 10 },
    { id: "help", title: t("supportPublic.nav.help"), url: "/support/docs", openInNewWindow: false, visible: true, sortNo: 20 },
    { id: "community", title: t("supportPublic.nav.community"), url: "/support/community/posts", openInNewWindow: false, visible: true, sortNo: 30 },
  ]
}

export function SupportHeader({
  section,
  leading,
  mobileNavigation,
  className,
}: {
  section: SupportHeaderSection
  leading?: ReactNode
  mobileNavigation?: {
    title: string
    content: ReactNode
  }
  className?: string
}) {
  const t = useI18n()
  const pathname = usePathname()
  const fallbackNavigation = useMemo(() => defaultSupportNavigationMenu(t), [t])
  const [navigationItems, setNavigationItems] = useState<SupportNavigationMenuItem[]>(fallbackNavigation)
  const [companyName, setCompanyName] = useState<string>("")

  useEffect(() => {
    void fetchPublicConfig()
      .then((cfg) => {
        if (cfg?.companyName) {
          setCompanyName(cfg.companyName)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let ignore = false
    void fetchSupportConfig()
      .then((config) => {
        if (!ignore && config.navigationMenu.length > 0) {
          setNavigationItems(config.navigationMenu)
        }
      })
      .catch(() => {
        if (!ignore) {
          setNavigationItems(fallbackNavigation)
        }
      })
    return () => {
      ignore = true
    }
  }, [fallbackNavigation])

  const isActive = (href: string) => {
    return href === "/support"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <div className="mx-auto flex h-14 max-w-[var(--support-docs-max-width)] items-center gap-3 px-4 sm:px-6 md:px-8 xl:px-6">
        <SupportMobileMenu navigationItems={navigationItems} pathname={pathname} secondary={mobileNavigation} />
        {leading}
        <Link
          href="/support"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span>{companyName || "AGENT DESK"}</span>
          <span className="hidden border-l pl-2 font-normal text-muted-foreground sm:inline">
            {t(sectionTitleKey[section])}
          </span>
        </Link>
        <nav
          className="ml-auto hidden items-center gap-1 sm:flex"
          aria-label={t("supportPublic.home.badge")}
        >
          {navigationItems.map((item) => (
            <SupportNavigationLink
              key={item.id}
              item={item}
              active={isActive(item.url)}
            />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:ml-4">
          <SupportAccountControl />
          <ThemeToggle
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-md"
          />
        </div>
      </div>
    </header>
  )
}

function SupportNavigationLink({ item, active }: { item: SupportNavigationMenuItem; active: boolean }) {
  const className = cn(
    buttonVariants({
      variant: active ? "secondary" : "ghost",
      size: "sm",
    }),
    supportNavItemClass,
    "max-w-36"
  )
  const content = <span className="truncate">{item.title}</span>

  if (item.openInNewWindow || /^https?:\/\//i.test(item.url)) {
    return (
      <a
        className={className}
        href={item.url}
        target={item.openInNewWindow ? "_blank" : undefined}
        rel={item.openInNewWindow ? "noreferrer" : undefined}
      >
        {content}
      </a>
    )
  }

  return (
    <Link className={className} href={item.url}>
      {content}
    </Link>
  )
}

function SupportAccountControl() {
  const t = useI18n()
  const { ready, session, signingOut, signOut } = useSupportAuth()

  if (!ready) {
    return (
      <div
        className="h-7 w-20 animate-pulse rounded-md bg-muted"
        aria-label={t("supportPublic.account.loading")}
      />
    )
  }

  if (!session) {
    return (
      <Link
        className={cn(
          buttonVariants({ size: "sm" }),
          supportNavItemClass,
          "hover:bg-primary/90"
        )}
        href="/support/login"
      >
        {t("supportPublic.nav.login")}
      </Link>
    )
  }

  const user = session.user
  const displayName = user.nickname || user.username
  const fallback = displayName.slice(0, 1).toUpperCase() || "U"

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <button
            className="inline-flex h-8 max-w-48 items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          />
        }
        aria-label={t("supportPublic.account.openMenu")}
      >
        <Avatar className="size-[30px]">
          <AvatarImage src={user.avatar} alt={displayName} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-24 truncate sm:inline sm:max-w-32">
          {displayName}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 min-w-56 rounded-md">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left">
              <Avatar className="size-8">
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
        <DropdownMenuItem render={<Link href="/support/profile" />} className="h-8 px-2">
          <UserRoundIcon />
          {t("supportPublic.account.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/support/profile/edit" />} className="h-8 px-2">
          <PencilIcon />
          {t("supportPublic.account.editProfile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onClick={() => void signOut()}
          className="h-8 px-2"
          variant="destructive"
        >
          {signingOut ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <LogOutIcon />
          )}
          {signingOut
            ? t("supportPublic.account.signingOut")
            : t("supportPublic.account.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
