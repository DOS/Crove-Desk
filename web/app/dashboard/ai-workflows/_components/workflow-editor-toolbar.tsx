"use client"

import type { ReactNode } from "react"
import {
  CheckIcon,
  Redo2Icon,
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
    <div className="inline-flex min-h-9 w-fit max-w-full items-center rounded-md bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur">
      <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden">
        {toolbarExtra}
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950" disabled={undoDisabled} onClick={onUndo}>
          <Undo2Icon className="size-3.5" />
          撤销
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950" disabled={redoDisabled} onClick={onRedo}>
          <Redo2Icon className="size-3.5" />
          重做
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950" disabled={restoreDefaultDisabled} onClick={onRestoreDefault}>
          <RotateCcwIcon className="size-3.5" />
          恢复默认
        </Button>
        <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950" disabled={validateDisabled} onClick={onValidate}>
          <CheckIcon className="size-3.5" />
          检查
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-950" disabled={saveDraftDisabled} onClick={onSaveDraft}>
          <SaveIcon className="size-3.5" />
          保存
        </Button>
        <Button type="button" size="sm" className="h-7 shrink-0 bg-[#2575FC] px-2 text-xs hover:bg-[#1b63d8]" disabled={publishDisabled} onClick={onPublish}>
          <SendIcon className="size-3.5" />
          发布
        </Button>
      </div>
    </div>
  )
}
