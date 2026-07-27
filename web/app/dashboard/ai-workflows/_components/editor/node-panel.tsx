"use client"

import type {
  NodePanelRenderProps,
  NodePanelResult,
} from "@flowgram.ai/free-node-panel-plugin"
import { useClientContext } from "@flowgram.ai/free-layout-editor"

import { useWorkflowEditorContext } from "./editor-context"
import { WorkflowNodeIcon } from "./node-icon"
import { createNodeJSON } from "./workflow-model"

export function NodePanel({
  position,
  onSelect,
  onClose,
}: NodePanelRenderProps) {
  const { nodeSpecs } = useWorkflowEditorContext()
  const { document } = useClientContext()
  const visibleSpecs = nodeSpecs.filter((spec) => spec.type !== "start")

  function select(spec: (typeof nodeSpecs)[number], event: React.MouseEvent) {
    onSelect({
      nodeType: spec.type,
      nodeJSON: createNodeJSON(
        spec,
        document.getAllNodes().map((node) => node.id)
      ),
      selectEvent: event,
    } satisfies Exclude<NodePanelResult, undefined>)
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
        aria-label="关闭节点面板"
      />
      <div
        className="absolute z-50 w-[180px] overflow-hidden rounded-lg border border-[rgba(68,83,130,0.25)] bg-white p-2 shadow-[0_4px_12px_rgba(0,0,0,0.02),0_2px_6px_rgba(0,0,0,0.04)]"
        style={{
          left: position.x + 30,
          top: position.y,
          transform: "translateY(-100%)",
        }}
      >
        <div className="max-h-[500px] overflow-y-auto [scrollbar-width:none]">
          {visibleSpecs.map((spec) => (
            <button
              key={spec.type}
              type="button"
              data-testid={`demo-free-node-list-${spec.type}`}
              className="flex h-8 w-full items-center rounded-[5px] px-[15px] text-left hover:bg-[hsla(252,62%,55%,0.09)] hover:text-[hsl(252,62%,55%)]"
              onClick={(event) => select(spec, event)}
            >
              <WorkflowNodeIcon name={spec.icon} className="size-3.5 shrink-0" />
              <span className="ml-2.5 truncate text-xs">{spec.title}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
