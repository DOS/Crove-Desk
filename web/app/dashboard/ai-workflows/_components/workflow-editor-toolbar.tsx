"use client"

import type { ReactNode } from "react"
import {
  CheckCircle2Icon,
  Maximize2Icon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
  SparklesIcon,
  Undo2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  onAutoLayout,
  autoLayoutDisabled = false,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitView,
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
  onAutoLayout?: () => void
  autoLayoutDisabled?: boolean
  zoomPercent?: string
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void
  onFitView?: () => void
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
    <div className="relative z-50 flex h-10 shrink-0 items-center justify-between border-b bg-background px-2">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs",
            validation.valid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          )}
        >
          <CheckCircle2Icon className="size-3" />
          {validation.valid ? "本地检查通过" : `${validation.errors.length} 个本地问题`}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {nodeCount} 个节点 / {edgeCount} 条连线
        </span>
      </div>
      <div className="flex items-center gap-1">
        {toolbarExtra}
        <div className="flex h-7 items-center rounded-lg border bg-muted/30 p-0.5">
          <WorkflowToolbarIconButton label="缩小" onClick={onZoomOut}>
            <MinusIcon className="size-3.5" />
          </WorkflowToolbarIconButton>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-12 px-1 text-xs tabular-nums"
                  aria-label="重置为 100%"
                  disabled={!onResetZoom}
                  onClick={onResetZoom}
                />
              }
            >
              {zoomPercent ?? "100%"}
            </TooltipTrigger>
            <TooltipContent>重置为 100%</TooltipContent>
          </Tooltip>
          <WorkflowToolbarIconButton label="放大" onClick={onZoomIn}>
            <PlusIcon className="size-3.5" />
          </WorkflowToolbarIconButton>
          <WorkflowToolbarIconButton label="适配画布" onClick={onFitView}>
            <Maximize2Icon className="size-3.5" />
          </WorkflowToolbarIconButton>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={undoDisabled} onClick={onUndo}>
          <Undo2Icon className="size-3.5" />
          撤销
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={redoDisabled} onClick={onRedo}>
          重做
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={autoLayoutDisabled} onClick={onAutoLayout}>
          <SparklesIcon className="size-3.5" />
          自动布局
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={restoreDefaultDisabled} onClick={onRestoreDefault}>
          <RotateCcwIcon className="size-3.5" />
          恢复默认
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={validateDisabled} onClick={onValidate}>
          检查
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={saveDraftDisabled} onClick={onSaveDraft}>
          <SaveIcon className="size-3.5" />
          保存
        </Button>
        <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={publishDisabled} onClick={onPublish}>
          <SendIcon className="size-3.5" />
          发布
        </Button>
      </div>
    </div>
  )
}

function WorkflowToolbarIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6"
            aria-label={label}
            disabled={!onClick}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
