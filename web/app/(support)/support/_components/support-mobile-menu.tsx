"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { MenuIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useI18n } from "@/i18n/provider"
import type { SupportNavigationMenuItem } from "@/lib/api/support-config"
import { cn } from "@/lib/utils"

type SupportMobileMenuProps = {
  navigationItems: SupportNavigationMenuItem[]
  pathname: string
  secondary?: {
    title: string
    content: ReactNode
  }
}

export function SupportMobileMenu({ navigationItems, pathname, secondary }: SupportMobileMenuProps) {
  const t = useI18n()
  const [open, setOpen] = useState(false)
  const triggerClassName = secondary ? "xl:hidden" : "sm:hidden"
  const isActive = (href: string) => href === "/support" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("size-8 rounded-md", triggerClassName)}
          />
        }
        aria-label={t("supportPublic.a11y.openMenu")}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[min(88vw,22.5rem)] gap-0 rounded-r-md p-0 sm:max-w-sm"
      >
        <SheetHeader className="flex h-14 flex-row items-center justify-between border-b px-4 py-0">
          <SheetTitle className="text-sm font-semibold tracking-tight">
            AGENT DESK
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-md"
            onClick={() => setOpen(false)}
            aria-label={t("supportPublic.a11y.closeMenu")}
          >
            <XIcon />
          </Button>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-4 py-4">
            <div className="text-xs font-medium text-muted-foreground">
              {t("supportPublic.nav.siteNavigation")}
            </div>
            <nav className="mt-2 grid gap-1" aria-label={t("supportPublic.nav.siteNavigation")}>
              {navigationItems.map((item) => {
                const active = isActive(item.url)
                const external = item.openInNewWindow || /^https?:\/\//i.test(item.url)
                const className = cn(
                  "flex h-9 items-center rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )
                if (external) {
                  return (
                    <a
                      key={item.id}
                      href={item.url}
                      target={item.openInNewWindow ? "_blank" : undefined}
                      rel={item.openInNewWindow ? "noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className={className}
                    >
                      <span className="truncate">{item.title}</span>
                    </a>
                  )
                }
                return (
                  <Link
                    key={item.id}
                    href={item.url}
                    onClick={() => setOpen(false)}
                    className={className}
                  >
                    <span className="truncate">{item.title}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          {secondary ? (
            <div className="border-t px-4 py-4">
              <div className="text-xs font-medium text-muted-foreground">
                {secondary.title}
              </div>
              <div
                className="mt-2"
                onClickCapture={(event) => {
                  if ((event.target as HTMLElement).closest("a, [data-support-mobile-menu-close='true']")) {
                    setOpen(false)
                  }
                }}
              >
                {secondary.content}
              </div>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
