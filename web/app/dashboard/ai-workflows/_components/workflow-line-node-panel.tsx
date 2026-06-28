"use client"

import { useEffect, useMemo, useRef } from "react"

import type { NodePanelRenderProps } from "@flowgram.ai/free-node-panel-plugin"
import { useClientContext } from "@flowgram.ai/free-layout-editor"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import { WorkflowNodeIcon } from "./workflow-node-icon"
import { createWorkflowNodeFromSpec } from "./workflow-utils"

export function WorkflowLineNodePanel({
  position,
  onSelect,
  onClose,
  nodeSpecs,
}: NodePanelRenderProps & {
  nodeSpecs: AIWorkflowNodeSpec[]
}) {
  const context = useClientContext()
  const panelRef = useRef<HTMLDivElement>(null)
  const insertableNodeSpecs = useMemo(
    () => nodeSpecs.filter((spec) => spec.type !== "start" && spec.type !== "end"),
    [nodeSpecs]
  )

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && panelRef.current?.contains(target)) {
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
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute z-[9999] w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-[0_14px_35px_rgba(15,23,42,0.16)]"
      style={{
        left: position.x + 16,
        top: position.y - 8,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="border-b border-slate-100 px-3 pb-2 pt-1 text-xs font-medium text-slate-500">
        插入节点
      </div>
      <div className="max-h-80 overflow-y-auto p-1.5">
        {insertableNodeSpecs.map((spec) => (
          <button
            key={spec.type}
            type="button"
            className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-slate-50"
            onClick={(event) => {
              event.stopPropagation()
              const definition = context.document.toJSON() as AIWorkflowDefinition
              const nodeJSON = createWorkflowNodeFromSpec(spec, definition.nodes ?? [], position)
              onSelect({
                nodeType: spec.type,
                nodeJSON,
                selectEvent: event,
              })
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
    </div>
  )
}
