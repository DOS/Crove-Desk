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
        "w-[360px] overflow-hidden rounded-lg border bg-background shadow-[0_2px_6px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)] transition-colors",
        selected ? "border-[#4e40e5]" : "border-[rgba(6,7,9,0.15)]"
      )}
      style={{ padding: 0 }}
      portPrimaryColor="#4e40e5"
      portSecondaryColor="#d0d5dd"
      portBackgroundColor="#fff"
    >
      {form?.render()}
    </WorkflowNodeRenderer>
  )
}
