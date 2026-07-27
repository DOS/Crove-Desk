"use client"

/* eslint-disable react-hooks/refs -- FlowGram useNodeRender exposes reactive render state through a ref-backed adapter. */

import { useLayoutEffect, useState } from "react"

import {
  WorkflowPortRender,
  type WorkflowNodeProps,
  useNodeRender,
} from "@flowgram.ai/free-layout-editor"
import { usePanelManager } from "@flowgram.ai/panel-manager-plugin"

import { cn } from "@/lib/utils"

import { WorkflowEditorSurfaceProvider } from "./editor-context"
import { usePortClick } from "./use-port-click"

export const NODE_FORM_PANEL = "workflow-node-form"

export function BaseNode(props: WorkflowNodeProps) {
  const render = useNodeRender(props.node)
  const panelManager = usePanelManager()
  const onPortClick = usePortClick()
  const [dragging, setDragging] = useState(false)

  useLayoutEffect(() => {
    if (String(render.node.flowNodeType) !== "condition") return
    const frame = window.requestAnimationFrame(() => {
      render.node.ports.updateDynamicPorts()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [render.data, render.node])

  return (
    <WorkflowEditorSurfaceProvider surface="canvas">
      <div
        ref={render.nodeRef}
        className={cn(
          "relative flex w-[360px] flex-col rounded-lg border bg-white",
          "border-[rgba(6,7,9,0.15)] shadow-[0_2px_6px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.02)]",
          render.selected && "border-[#4e40e5]",
          render.form?.state.invalid && "border-destructive"
        )}
        draggable={!render.readonly}
        onDragStart={(event) => {
          render.startDrag(event)
          setDragging(true)
        }}
        onTouchStart={(event) => {
          render.startDrag(event as unknown as React.MouseEvent)
          setDragging(true)
        }}
        onMouseUp={() => setDragging(false)}
        onClick={(event) => {
          render.selectNode(event)
          if (!render.readonly && !dragging) {
            panelManager.open(NODE_FORM_PANEL, "docked-right", {
              props: { nodeId: render.node.id },
            })
          }
        }}
        onFocus={render.onFocus}
        onBlur={render.onBlur}
      >
        {render.form?.render()}
      </div>
      {render.ports.map((port) => (
        <WorkflowPortRender
          key={port.id}
          entity={port}
          onClick={render.readonly ? undefined : onPortClick}
        />
      ))}
    </WorkflowEditorSurfaceProvider>
  )
}
