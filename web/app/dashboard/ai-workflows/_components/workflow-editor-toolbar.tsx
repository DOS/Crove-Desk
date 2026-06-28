"use client"

import type { ReactNode } from "react"
import {
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
  Undo2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"

export function WorkflowEditorToolbar({
  toolbarExtra,
  onUndo,
  undoDisabled = false,
  onRedo,
  redoDisabled = false,
  onRestoreDefault,
  restoreDefaultDisabled = false,
  onValidate,
  validateDisabled = false,
  onSaveDraft,
  saveDraftDisabled = false,
  onPublish,
  publishDisabled = false,
}: {
  toolbarExtra?: ReactNode
  onUndo?: () => void
  undoDisabled?: boolean
  onRedo?: () => void
  redoDisabled?: boolean
  onRestoreDefault?: () => void
  restoreDefaultDisabled?: boolean
  onValidate?: () => void
  validateDisabled?: boolean
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  onPublish?: () => void
  publishDisabled?: boolean
}) {
  return (
    <div className="inline-flex min-h-10 w-fit max-w-full items-center rounded-md bg-background/95 px-2 py-1 shadow-sm backdrop-blur">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {toolbarExtra}
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={undoDisabled} onClick={onUndo}>
          <Undo2Icon className="size-3.5" />
          撤销
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={redoDisabled} onClick={onRedo}>
          重做
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={restoreDefaultDisabled} onClick={onRestoreDefault}>
          <RotateCcwIcon className="size-3.5" />
          恢复默认
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={validateDisabled} onClick={onValidate}>
          检查
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={saveDraftDisabled} onClick={onSaveDraft}>
          <SaveIcon className="size-3.5" />
          保存
        </Button>
        <Button type="button" size="sm" className="h-7 shrink-0 px-2 text-xs" disabled={publishDisabled} onClick={onPublish}>
          <SendIcon className="size-3.5" />
          发布
        </Button>
      </div>
    </div>
  )
}
