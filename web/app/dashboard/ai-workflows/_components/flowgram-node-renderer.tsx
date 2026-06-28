import "@flowgram.ai/free-layout-editor/index.css"

import {
  useNodeRender,
  WorkflowNodeRenderer,
  type WorkflowNodeProps,
} from "@flowgram.ai/free-layout-editor"
import { useLayoutEffect } from "react"

import { cn } from "@/lib/utils"

export function FlowgramNodeRenderer(props: WorkflowNodeProps) {
  const { selected, node, form } = useNodeRender()
  const nodeType = String(node.flowNodeType ?? "")

  useLayoutEffect(() => {
    if (nodeType !== "condition") return
    const frame = window.requestAnimationFrame(() => {
      node.ports.updateDynamicPorts()
    })
    return () => window.cancelAnimationFrame(frame)
  })

  return (
    <WorkflowNodeRenderer
      node={props.node}
      className={cn(
        "overflow-visible rounded-lg border transition-colors",
        selected ? "border-(--g-selection-background)" : "border-transparent"
      )}
      style={{ padding: 0 }}
      portClassName="workflow-node-port"
      portPrimaryColor="#2575FC"
      portSecondaryColor="#c9cdd4"
      portBackgroundColor="#FFFFFF"
    >
      {form?.render()}
    </WorkflowNodeRenderer>
  )
}
