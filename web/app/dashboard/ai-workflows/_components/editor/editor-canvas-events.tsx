"use client"

import { useEffect } from "react"

import { WorkflowNodePanelService } from "@flowgram.ai/free-node-panel-plugin"
import {
  useClientContext,
  useService,
  WorkflowDragService,
  WorkflowSelectService,
  type WorkflowNodeEntity,
  type WorkflowNodeJSON,
} from "@flowgram.ai/free-layout-editor"

export function EditorCanvasEvents() {
  const context = useClientContext()
  const nodePanel = useService(WorkflowNodePanelService)
  const selection = useService(WorkflowSelectService)
  const dragService = useService(WorkflowDragService)

  useEffect(() => {
    const element = context.playground.node
    const handleContextMenu = (event: MouseEvent) => {
      if (context.playground.config.readonlyOrDisabled) return
      const position = context.playground.config.getPosFromMouseEvent(event)
      event.preventDefault()
      event.stopPropagation()
      void nodePanel.callNodePanel({
        position,
        onSelect: (result) => {
          if (!result) return
          const nodePosition = dragService.adjustSubNodePosition(
            result.nodeType,
            undefined,
            position
          )
          const node: WorkflowNodeEntity =
            context.document.createWorkflowNodeByType(
              result.nodeType,
              nodePosition,
              result.nodeJSON ?? ({} as WorkflowNodeJSON)
            )
          selection.selectNode(node)
        },
        onClose: () => undefined,
      })
    }
    element.addEventListener("contextmenu", handleContextMenu)
    return () => element.removeEventListener("contextmenu", handleContextMenu)
  }, [context, dragService, nodePanel, selection])

  return null
}
