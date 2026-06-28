"use client"

import type { ReactNode } from "react"
import { Maximize2Icon, MinusIcon, PlusIcon, SparklesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function WorkflowCanvasControls({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitView,
  onAutoLayout,
  autoLayoutDisabled = false,
}: {
  zoomPercent?: string
  onZoomIn?: () => void
  onZoomOut?: () => void
  onResetZoom?: () => void
  onFitView?: () => void
  onAutoLayout?: () => void
  autoLayoutDisabled?: boolean
}) {
  return (
    <div className="inline-flex h-9 items-center gap-0.5 rounded-md border border-slate-200/80 bg-white/95 p-1 shadow-sm backdrop-blur">
      <CanvasControlButton label="缩小" onClick={onZoomOut}>
        <MinusIcon className="size-3.5" />
      </CanvasControlButton>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-12 px-1 text-xs tabular-nums text-slate-700 hover:bg-slate-100 hover:text-slate-950"
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
      <CanvasControlButton label="放大" onClick={onZoomIn}>
        <PlusIcon className="size-3.5" />
      </CanvasControlButton>
      <span className="mx-1 h-4 w-px shrink-0 bg-slate-200" />
      <CanvasControlButton label="适配画布" onClick={onFitView}>
        <Maximize2Icon className="size-3.5" />
      </CanvasControlButton>
      <CanvasControlButton label="自动布局" onClick={onAutoLayout} disabled={autoLayoutDisabled}>
        <SparklesIcon className="size-3.5" />
      </CanvasControlButton>
    </div>
  )
}

function CanvasControlButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
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
            className="size-7 text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            aria-label={label}
            disabled={disabled || !onClick}
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
