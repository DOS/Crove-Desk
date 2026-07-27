import {
  WorkflowNodePanelService,
  WorkflowNodePanelUtils,
} from "@flowgram.ai/free-node-panel-plugin"
import {
  delay,
  type FreeLayoutPluginContext,
  type onDragLineEndParams,
  WorkflowDragService,
  WorkflowLinesManager,
  type WorkflowNodeEntity,
  type WorkflowNodeJSON,
} from "@flowgram.ai/free-layout-editor"

export async function onDragLineEnd(
  context: FreeLayoutPluginContext,
  params: onDragLineEndParams
) {
  const { fromPort, toPort, mousePos, line, originLine } = params
  if (originLine || !line || toPort || !fromPort) return

  const nodePanel = context.get(WorkflowNodePanelService)
  const dragService = context.get(WorkflowDragService)
  const linesManager = context.get(WorkflowLinesManager)
  const containerNode = fromPort.node.parent
  const result = await nodePanel.singleSelectNodePanel({
    position:
      fromPort.location === "bottom"
        ? { x: mousePos.x - 165, y: mousePos.y + 60 }
        : mousePos,
    containerNode,
    panelProps: {
      enableNodePlaceholder: true,
      enableScrollClose: true,
      fromPort,
    },
  })
  if (!result) return

  const position = WorkflowNodePanelUtils.adjustNodePosition({
    nodeType: result.nodeType,
    position: mousePos,
    fromPort,
    toPort,
    containerNode,
    document: context.document,
    dragService,
  })
  const node: WorkflowNodeEntity = context.document.createWorkflowNodeByType(
    result.nodeType,
    position,
    result.nodeJSON ?? ({} as WorkflowNodeJSON),
    containerNode?.id
  )
  await delay(20)
  WorkflowNodePanelUtils.buildLine({ fromPort, node, linesManager })
}
