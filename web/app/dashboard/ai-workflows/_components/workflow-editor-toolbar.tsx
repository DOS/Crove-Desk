"use client"

import type { ReactNode } from "react"
import {
  CheckCircle2Icon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
  Undo2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { WorkflowDraftValidation } from "./workflow-utils"

export function WorkflowEditorToolbar({
  validation,
  nodeCount,
  edgeCount,
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
  validation: WorkflowDraftValidation
  nodeCount: number
  edgeCount: number
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
    <div className="inline-flex min-h-10 w-fit max-w-full items-center gap-3 rounded-md bg-background/95 px-2 py-1 shadow-sm backdrop-blur">
      <div className="flex min-w-0 shrink items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs",
            validation.valid ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-700"
          )}
        >
          <CheckCircle2Icon className="size-3" />
          {validation.valid ? "本地检查通过" : `${validation.errors.length} 个本地问题`}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {nodeCount} 个节点 / {edgeCount} 条连线
        </span>
      </div>
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
