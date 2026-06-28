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
        "overflow-visible rounded-2xl border transition-colors",
        selected ? "border-(--g-selection-background)" : "border-transparent"
      )}
      style={{ padding: 0 }}
      portPrimaryColor="var(--g-selection-background)"
      portSecondaryColor="#c9cdd4"
      portBackgroundColor="hsl(var(--background))"
    >
      {form?.render()}
    </WorkflowNodeRenderer>
  )
}
