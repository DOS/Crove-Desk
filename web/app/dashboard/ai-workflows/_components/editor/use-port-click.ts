"use client"

import { useCallback } from "react"

import {
  WorkflowNodePanelService,
  WorkflowNodePanelUtils,
} from "@flowgram.ai/free-node-panel-plugin"
import {
  delay,
  usePlayground,
  useService,
  WorkflowDocument,
  WorkflowDragService,
  WorkflowLinesManager,
  type WorkflowNodeEntity,
  type WorkflowNodeJSON,
  type WorkflowPortEntity,
} from "@flowgram.ai/free-layout-editor"

export function usePortClick() {
  const playground = usePlayground()
  const nodePanel = useService(WorkflowNodePanelService)
  const document = useService(WorkflowDocument)
  const dragService = useService(WorkflowDragService)
  const linesManager = useService(WorkflowLinesManager)

  return useCallback(
    async (event: React.MouseEvent, port: WorkflowPortEntity) => {
      if (port.portType === "input") return
      const mousePosition = playground.config.getPosFromMouseEvent(event)
      const containerNode = port.node.parent
      const result = await nodePanel.singleSelectNodePanel({
        position: mousePosition,
        containerNode,
        panelProps: {
          enableScrollClose: true,
          fromPort: port,
        },
      })
      if (!result) return

      const nodePosition = WorkflowNodePanelUtils.adjustNodePosition({
        nodeType: result.nodeType,
        position:
          port.location === "bottom"
            ? { x: mousePosition.x, y: mousePosition.y + 100 }
            : { x: mousePosition.x + 100, y: mousePosition.y },
        fromPort: port,
        containerNode,
        document,
        dragService,
      })
      const node: WorkflowNodeEntity = document.createWorkflowNodeByType(
        result.nodeType,
        nodePosition,
        result.nodeJSON ?? ({} as WorkflowNodeJSON),
        containerNode?.id
      )
      await delay(20)
      WorkflowNodePanelUtils.buildLine({
        fromPort: port,
        node,
        linesManager,
      })
    },
    [document, dragService, linesManager, nodePanel, playground]
  )
}
