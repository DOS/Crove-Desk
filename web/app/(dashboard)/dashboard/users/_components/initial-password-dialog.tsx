"use client"

import { useState } from "react"
import { CopyIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type InitialPasswordDialogProps = {
  open: boolean
  username: string
  password: string
  onOpenChange: (open: boolean) => void
}

export function InitialPasswordDialog({
  open,
  username,
  password,
  onOpenChange,
}: InitialPasswordDialogProps) {
  const t = useI18n()
  const [copying, setCopying] = useState(false)

  async function handleCopy() {
    if (!password || copying) {
      return
    }

    setCopying(true)
    try {
      await navigator.clipboard.writeText(password)
      toast.success(t("user.copied"))
    } catch {
      toast.error(t("user.copyFailed"))
    } finally {
      setCopying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("user.createdTitle")}</DialogTitle>
          <DialogDescription>
            {t("user.initialPasswordDescription", { username: username || "-" })}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/35 p-4">
          <div className="text-xs text-muted-foreground">{t("user.initialPassword")}</div>
          <div className="mt-2 break-all font-mono text-base">{password}</div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
            disabled={copying || !password}
          >
            <CopyIcon />
            {copying ? t("user.copying") : t("user.copyPassword")}
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t("user.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
