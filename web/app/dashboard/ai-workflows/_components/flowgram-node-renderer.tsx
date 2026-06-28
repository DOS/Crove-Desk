import "@flowgram.ai/free-layout-editor/index.css"

import {
  useNodeRender,
  WorkflowNodeRenderer,
  type WorkflowNodeProps,
} from "@flowgram.ai/free-layout-editor"
import { useLayoutEffect } from "react"

import { cn } from "@/lib/utils"
import { useWorkflowPortAdd } from "./workflow-port-add-context"

export function FlowgramNodeRenderer(props: WorkflowNodeProps) {
  const { selected, node, form } = useNodeRender()
  const requestPortAdd = useWorkflowPortAdd()
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
      onPortClick={(port, event) => {
        if (port.portType !== "output" || typeof event === "function") {
          return
        }
        event.stopPropagation()
        requestPortAdd?.({ sourcePort: port, event })
      }}
    >
      {form?.render()}
    </WorkflowNodeRenderer>
  )
}
