"use client"

import type { LineRenderProps } from "@flowgram.ai/free-lines-plugin"
import { PlusIcon } from "lucide-react"
import { usePlayground } from "@flowgram.ai/free-layout-editor"

import { useWorkflowPortAdd } from "./workflow-port-add-context"

export function WorkflowLineAddButton({
  line,
  selected,
  hovered,
  color,
}: LineRenderProps) {
  const playground = usePlayground()
  const requestPortAdd = useWorkflowPortAdd()
  const { fromPort, toPort } = line
  const visible = !line.disposed && !playground.config.readonly && (selected || hovered)

  if (!visible) {
    return null
  }

  return (
    <button
      type="button"
      className="absolute flex size-6 items-center justify-center rounded-full border border-white bg-white text-[#2575FC] shadow-sm transition-transform" // hover:scale-105
      style={{
        transform: `translate(-50%, -50%) translate(${line.center.labelX}px, ${line.center.labelY}px)`,
        color,
        pointerEvents: "all",
      }}
      aria-label="添加节点"
      data-line-id={line.id}
      onClick={(event) => {
        event.stopPropagation()
        if (!fromPort || !toPort) {
          return
        }
        requestPortAdd?.({
          sourcePort: fromPort,
          targetPort: toPort,
          line,
          event,
        })
      }}
    >
      <PlusIcon className="size-3.5" strokeWidth={2.4} />
    </button>
  )
}
