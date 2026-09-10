"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangleIcon,
  ArrowRightLeftIcon,
  Building2Icon,
  CheckIcon,
  GitMergeIcon,
  MailIcon,
  PhoneIcon,
  SearchIcon,
  UserRoundIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ProjectDialog } from "@/components/project-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/i18n/provider"
import {
  fetchCustomer,
  fetchCustomers,
  mergeCustomer,
  type AdminCustomer,
} from "@/lib/api/customer"
import { cn, formatDateTime } from "@/lib/utils"

export type CustomerMergeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current customer from context, pre-populated as primary or source. */
  currentCustomer?: AdminCustomer | null
  currentCustomerId?: number | null
  onSuccess?: (mergedCustomer: AdminCustomer) => void | Promise<void>
}

export function CustomerMergeDialog({
  open,
  onOpenChange,
  currentCustomer,
  currentCustomerId,
  onSuccess,
}: CustomerMergeDialogProps) {
  const t = useI18n()
  const [primaryCustomer, setPrimaryCustomer] = useState<AdminCustomer | null>(null)
  const [duplicateCustomer, setDuplicateCustomer] = useState<AdminCustomer | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<AdminCustomer[]>([])
  const [reason, setReason] = useState("")
  const [merging, setMerging] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)

  // Initialize primary customer when dialog opens
  useEffect(() => {
    if (!open) {
      setPrimaryCustomer(null)
      setDuplicateCustomer(null)
      setSearchQuery("")
      setSearchResults([])
      setReason("")
      return
    }

    if (currentCustomer) {
      setPrimaryCustomer(currentCustomer)
      return
    }

    if (currentCustomerId) {
      setLoadingInitial(true)
      fetchCustomer(currentCustomerId)
        .then((data) => {
          if (data) setPrimaryCustomer(data)
        })
        .catch(() => {})
        .finally(() => setLoadingInitial(false))
    }
  }, [currentCustomer, currentCustomerId, open])

  const handleSearch = async () => {
    const q = searchQuery.trim()
    if (!q) {
      toast.error(t("customerLink.keywordRequired"))
      return
    }

    setSearching(true)
    try {
      const data = await fetchCustomers({
        keyword: q,
        page: 1,
        limit: 20,
        status: 0,
      })
      // Exclude primary customer from search results
      const filtered = (data.results || []).filter(
        (c) => c.id !== primaryCustomer?.id,
      )
      setSearchResults(filtered)
      if (filtered.length === 0) {
        toast.message(t("customerLink.noMatch"))
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("customerLink.searchFailed"))
    } finally {
      setSearching(false)
    }
  }

  const handleSwap = () => {
    if (!primaryCustomer || !duplicateCustomer) return
    const temp = primaryCustomer
    setPrimaryCustomer(duplicateCustomer)
    setDuplicateCustomer(temp)
  }

  const handleSelectDuplicate = (customer: AdminCustomer) => {
    setDuplicateCustomer(customer)
    setSearchResults([])
    setSearchQuery("")
  }

  const handleMerge = async () => {
    if (!primaryCustomer || !duplicateCustomer) return
    if (primaryCustomer.id === duplicateCustomer.id) {
      toast.error(t("customerMerge.sameCustomerError"))
      return
    }

    setMerging(true)
    try {
      const res = await mergeCustomer({
        targetCustomerId: primaryCustomer.id,
        sourceCustomerId: duplicateCustomer.id,
        reason: reason.trim() || undefined,
      })
      toast.success(t("customerMerge.mergeSuccess"))
      onOpenChange(false)
      await onSuccess?.(res)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("customerMerge.mergeFailed"))
    } finally {
      setMerging(false)
    }
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <GitMergeIcon className="size-5 text-primary" />
          <span>{t("customerMerge.title")}</span>
        </div>
      }
      description={t("customerMerge.description")}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={merging}
          >
            {t("common.cancel")}
          </Button>

          <Button
            type="button"
            onClick={handleMerge}
            disabled={!primaryCustomer || !duplicateCustomer || merging}
            className="gap-1.5"
          >
            <GitMergeIcon className="size-4" />
            {merging ? t("customerMerge.merging") : t("customerMerge.confirmButton")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Warning Notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>{t("customerMerge.warningNotice")}</p>
        </div>

        {/* 2-Column Comparison with Swap */}
        <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Primary Customer (Keep) */}
          <div className="flex flex-col rounded-lg border-2 border-primary/30 bg-primary/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <Badge variant="default" className="bg-primary text-[11px] font-semibold">
                {t("customerMerge.primaryCustomer")}
              </Badge>
              {primaryCustomer ? (
                <span className="font-mono text-xs text-muted-foreground">#{primaryCustomer.id}</span>
              ) : null}
            </div>

            {primaryCustomer ? (
              <CustomerCardSummary customer={primaryCustomer} />
            ) : (
              <div className="flex flex-1 items-center justify-center py-6 text-xs text-muted-foreground">
                {loadingInitial ? t("common.loading") : t("customerMerge.selectCustomerPrompt")}
              </div>
            )}
          </div>

          {/* Swap Button in center for Desktop */}
          {primaryCustomer && duplicateCustomer ? (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden sm:block">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSwap}
                title={t("customerMerge.swap")}
                className="size-8 rounded-full shadow-md bg-background hover:bg-muted"
              >
                <ArrowRightLeftIcon className="size-3.5" />
              </Button>
            </div>
          ) : null}

          {/* Duplicate Customer (Merge & Remove) */}
          <div className="flex flex-col rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-destructive/40 text-destructive text-[11px] font-semibold">
                {t("customerMerge.sourceCustomer")}
              </Badge>
              {duplicateCustomer ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">#{duplicateCustomer.id}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => setDuplicateCustomer(null)}
                  >
                    ✕
                  </Button>
                </div>
              ) : null}
            </div>

            {duplicateCustomer ? (
              <CustomerCardSummary customer={duplicateCustomer} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{t("customerMerge.selectCustomerPrompt")}</p>
                <p className="text-[11px]">{t("customerMerge.searchPlaceholder")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Swap button on mobile */}
        {primaryCustomer && duplicateCustomer ? (
          <div className="flex justify-center sm:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSwap}
              className="gap-1.5 text-xs"
            >
              <ArrowRightLeftIcon className="size-3.5" />
              {t("customerMerge.swap")}
            </Button>
          </div>
        ) : null}

        {/* Search for Duplicate Customer if not selected yet */}
        {!duplicateCustomer ? (
          <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
            <label className="text-xs font-medium text-foreground">
              {t("customerMerge.searchCustomer")}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void handleSearch()
                    }
                  }}
                  placeholder={t("customerMerge.searchPlaceholder")}
                  className="h-8.5 pl-8 text-xs"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSearch}
                disabled={searching}
                className="h-8.5 px-3 text-xs"
              >
                {searching ? t("customerLink.searching") : t("customerLink.search")}
              </Button>
            </div>

            {/* Search Results list */}
            {searchResults.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-md border bg-background divide-y">
                {searchResults.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => handleSelectDuplicate(customer)}
                    className="flex cursor-pointer items-center justify-between p-2.5 text-xs transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <span className="truncate">{customer.name || t("customerLink.fallbackName", { id: customer.id })}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">#{customer.id}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        {customer.primaryEmail ? <span>{customer.primaryEmail}</span> : null}
                        {customer.primaryMobile ? <span>{customer.primaryMobile}</span> : null}
                        {customer.company?.name ? (
                          <span className="font-medium text-foreground/80">{customer.company.name}</span>
                        ) : null}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      {t("customerLink.select")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Reason / Notes */}
        <div className="space-y-1.5">
          <label htmlFor="merge-reason" className="text-xs font-medium text-foreground">
            {t("customerMerge.reason")}
          </label>
          <Textarea
            id="merge-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("customerMerge.reasonPlaceholder")}
            className="text-xs resize-none"
          />
        </div>
      </div>
    </ProjectDialog>
  )
}

function CustomerCardSummary({ customer }: { customer: AdminCustomer }) {
  const displayName = customer.name.trim() || `Customer #${customer.id}`
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-muted text-[10px] font-medium text-foreground">
            {displayName.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-foreground text-sm">{displayName}</div>
          <div className="text-[11px] text-muted-foreground">
            Created: {formatDateTime(customer.createdAt)}
          </div>
        </div>
      </div>

      <div className="space-y-1 pt-1 text-[11px]">
        {customer.primaryEmail ? (
          <div className="flex items-center gap-1.5 text-foreground truncate">
            <MailIcon className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate">{customer.primaryEmail}</span>
          </div>
        ) : null}
        {customer.primaryMobile ? (
          <div className="flex items-center gap-1.5 text-foreground truncate">
            <PhoneIcon className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate">{customer.primaryMobile}</span>
          </div>
        ) : null}
        {customer.company?.name ? (
          <div className="flex items-center gap-1.5 text-foreground truncate">
            <Building2Icon className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate font-medium">{customer.company.name}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
