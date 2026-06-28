"use client"

import { useEffect, useMemo, useRef } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import type { AIWorkflowNodeSpec } from "@/lib/api/admin"
import { WorkflowNodeIcon } from "./workflow-node-icon"

export type WorkflowPortNodeMenuState = {
  x: number
  y: number
}

export function WorkflowPortNodeMenu({
  open,
  position,
  nodeSpecs,
  onSelect,
  onClose,
}: {
  open: boolean
  position: WorkflowPortNodeMenuState | null
  nodeSpecs: AIWorkflowNodeSpec[]
  onSelect: (spec: AIWorkflowNodeSpec) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const insertableNodeSpecs = useMemo(
    () => nodeSpecs.filter((spec) => spec.type !== "start"),
    [nodeSpecs]
  )

  useEffect(() => {
    if (!open) {
      return
    }
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return
      }
      onClose()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("pointerdown", closeOnPointerDown)
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown)
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [onClose, open])

  if (!open || !position) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="pointer-events-auto absolute z-[80] w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-[0_14px_35px_rgba(15,23,42,0.16)]"
      style={{
        left: position.x,
        top: position.y,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="border-b border-slate-100 px-3 pb-2 pt-1 text-xs font-medium text-slate-500">
        添加节点
      </div>
      <ScrollArea className="h-80 max-h-[min(20rem,calc(100vh-8rem))]">
        <div className="p-1.5">
          {insertableNodeSpecs.map((spec) => (
            <button
              key={spec.type}
              type="button"
              className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-slate-50"
              onClick={(event) => {
                event.stopPropagation()
                onSelect(spec)
              }}
            >
              <WorkflowNodeIcon icon={spec.icon} size="sm" className="mt-0.5" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">
                  {spec.title || spec.type}
                </span>
                {spec.description ? (
                  <span className="line-clamp-2 text-xs text-slate-500">
                    {spec.description}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
