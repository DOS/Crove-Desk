"use client"

import { useCallback } from "react"

import {
  WorkflowNodePanelService,
  WorkflowNodePanelUtils,
} from "@flowgram.ai/free-node-panel-plugin"
import type { LineRenderProps } from "@flowgram.ai/free-lines-plugin"
import {
  delay,
  HistoryService,
  useService,
  WorkflowDocument,
  WorkflowDragService,
  WorkflowLinesManager,
  type WorkflowNodeEntity,
  type WorkflowNodeJSON,
} from "@flowgram.ai/free-layout-editor"
import { PlusIcon } from "lucide-react"

export function LineAddButton({
  line,
  selected,
  hovered,
  color,
}: LineRenderProps) {
  const nodePanel = useService(WorkflowNodePanelService)
  const document = useService(WorkflowDocument)
  const dragService = useService(WorkflowDragService)
  const linesManager = useService(WorkflowLinesManager)
  const history = useService(HistoryService)
  const { fromPort, toPort } = line

  const addNode = useCallback(async () => {
    if (!fromPort || !toPort) return
    const position = {
      x: (line.position.from.x + line.position.to.x) / 2,
      y: (line.position.from.y + line.position.to.y) / 2,
    }
    const containerNode = fromPort.node.parent
    const result = await nodePanel.singleSelectNodePanel({
      position,
      containerNode,
      panelProps: { fromPort, enableScrollClose: true },
    })
    if (!result) return
    const nodePosition = WorkflowNodePanelUtils.adjustNodePosition({
      nodeType: result.nodeType,
      position,
      fromPort,
      toPort,
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
    WorkflowNodePanelUtils.subNodesAutoOffset({
      node,
      fromPort,
      toPort,
      containerNode,
      historyService: history,
      dragService,
      linesManager,
    })
    await delay(20)
    WorkflowNodePanelUtils.buildLine({ fromPort, node, toPort, linesManager })
    line.dispose()
  }, [document, dragService, fromPort, history, line, linesManager, nodePanel, toPort])

  if (!selected && !hovered) return null
  return (
    <button
      type="button"
      className="absolute z-10 flex size-6 items-center justify-center rounded-full border-2 bg-white shadow-sm hover:scale-110"
      style={{
        color,
        borderColor: color,
        transform: `translate(-50%, -50%) translate(${line.center.labelX}px, ${line.center.labelY}px)`,
      }}
      onClick={(event) => {
        event.stopPropagation()
        void addNode()
      }}
      aria-label="在线路中插入节点"
    >
      <PlusIcon className="size-3.5" />
    </button>
  )
}
