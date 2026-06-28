"use client"

import { useCallback } from "react"

import type { LineRenderProps } from "@flowgram.ai/free-lines-plugin"
import { WorkflowNodePanelService } from "@flowgram.ai/free-node-panel-plugin"
import { PlusIcon } from "lucide-react"
import { usePlayground, useService } from "@flowgram.ai/free-layout-editor"

export function WorkflowLineAddButton({
  line,
  selected,
  hovered,
  color,
}: LineRenderProps) {
  const playground = usePlayground()
  const nodePanelService = useService<WorkflowNodePanelService>(WorkflowNodePanelService)
  const { fromPort, toPort } = line
  const visible = !line.disposed && !playground.config.readonly && (selected || hovered)

  const openNodePanel = useCallback(() => {
    if (!fromPort || !toPort) {
      return
    }
    void nodePanelService.call({
      panelPosition: {
        x: line.center.labelX,
        y: line.center.labelY,
      },
      fromPort,
      toPort,
      panelProps: {
        fromPort,
      },
      enableBuildLine: true,
      enableAutoOffset: true,
      afterAddNode: (node) => {
        if (node && !line.disposed) {
          line.dispose()
        }
      },
    })
  }, [fromPort, line, nodePanelService, toPort])

  if (!visible) {
    return null
  }

  return (
    <button
      type="button"
      className="absolute flex size-6 items-center justify-center rounded-full border border-white bg-white text-[#2575FC] shadow-sm transition-transform hover:scale-105"
      style={{
        transform: `translate(-50%, -50%) translate(${line.center.labelX}px, ${line.center.labelY}px)`,
        color,
        pointerEvents: "all",
      }}
      aria-label="添加节点"
      data-line-id={line.id}
      onClick={(event) => {
        event.stopPropagation()
        openNodePanel()
      }}
    >
      <PlusIcon className="size-3.5" strokeWidth={2.4} />
    </button>
  )
}
