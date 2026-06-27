"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import { EditorRenderer, FreeLayoutEditorProvider } from "@flowgram.ai/free-layout-editor"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"

import { useFlowgramEditorProps } from "./flowgram-editor-provider"
import { WorkflowConfigSidebar } from "./workflow-config-sidebar"
import { WorkflowEditorToolbar } from "./workflow-editor-toolbar"
import { WorkflowNodePalette } from "./workflow-node-palette"
import {
  createWorkflowNodeFromSpec,
  deleteWorkflowNode,
  updateWorkflowNodeData,
  validateWorkflowDefinition,
  type WorkflowNodeData,
} from "./workflow-utils"

export function WorkflowEditor({
  definition,
  nodeSpecs,
  onDefinitionChange,
  onRestoreDefault,
  restoreDefaultDisabled = false,
  onUndo,
  undoDisabled = false,
  onRedo,
  redoDisabled = false,
  onValidate,
  validateDisabled = false,
  onSaveDraft,
  saveDraftDisabled = false,
  onPublish,
  publishDisabled = false,
  toolbarExtra,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  onDefinitionChange: (definition: AIWorkflowDefinition) => void
  onRestoreDefault?: () => void
  restoreDefaultDisabled?: boolean
  onUndo?: () => void
  undoDisabled?: boolean
  onRedo?: () => void
  redoDisabled?: boolean
  onValidate?: () => void
  validateDisabled?: boolean
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  onPublish?: () => void
  publishDisabled?: boolean
  toolbarExtra?: ReactNode
}) {
  const [localDefinition, setLocalDefinition] = useState(definition)
  const [editorKey, setEditorKey] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState(definition.nodes[0]?.id ?? "")

  useEffect(() => {
    setLocalDefinition(definition)
    setSelectedNodeId((current) => {
      if (definition.nodes.some((node) => node.id === current)) {
        return current
      }
      return definition.nodes[0]?.id ?? ""
    })
    setEditorKey((current) => current + 1)
  }, [definition])

  const validation = useMemo(
    () => validateWorkflowDefinition(localDefinition, nodeSpecs),
    [localDefinition, nodeSpecs]
  )

  const editorProps = useFlowgramEditorProps({
    definition: localDefinition,
    nodeSpecs,
    onDefinitionChange: (next) => {
      setLocalDefinition(next)
      onDefinitionChange(next)
    },
  })

  const emitDefinition = (next: AIWorkflowDefinition, remountEditor = false) => {
    setLocalDefinition(next)
    if (remountEditor) {
      setEditorKey((current) => current + 1)
    }
    onDefinitionChange(next)
  }

  const addNode = (spec: AIWorkflowNodeSpec) => {
    const nextNode = createWorkflowNodeFromSpec(spec, localDefinition.nodes, nextNodePosition(localDefinition))
    const next = {
      ...localDefinition,
      nodes: [...localDefinition.nodes, nextNode],
    }
    setSelectedNodeId(nextNode.id)
    emitDefinition(next, true)
  }

  const updateNodeData = (
    nodeId: string,
    data: WorkflowNodeData
  ) => {
    emitDefinition(updateWorkflowNodeData(localDefinition, nodeId, data))
  }

  const deleteNode = (nodeId: string) => {
    const next = deleteWorkflowNode(localDefinition, nodeId)
    const nextNodes = next.nodes
    setSelectedNodeId(nextNodes[0]?.id ?? "")
    emitDefinition(next, true)
  }

  return (
    <div className="flex min-h-[640px] flex-1 overflow-hidden border bg-background">
      <WorkflowNodePalette nodeSpecs={nodeSpecs} onAddNode={addNode} />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkflowEditorToolbar
          validation={validation}
          nodeCount={localDefinition.nodes.length}
          edgeCount={localDefinition.edges.length}
          toolbarExtra={toolbarExtra}
          onUndo={onUndo}
          undoDisabled={undoDisabled}
          onRedo={onRedo}
          redoDisabled={redoDisabled}
          onRestoreDefault={onRestoreDefault}
          restoreDefaultDisabled={restoreDefaultDisabled}
          onValidate={onValidate}
          validateDisabled={validateDisabled}
          onSaveDraft={onSaveDraft}
          saveDraftDisabled={saveDraftDisabled}
          onPublish={onPublish}
          publishDisabled={publishDisabled}
        />
        <div className="min-h-0 flex-1">
          <FreeLayoutEditorProvider key={editorKey} {...editorProps}>
            <EditorRenderer className="h-full w-full" />
          </FreeLayoutEditorProvider>
        </div>
      </div>

      <WorkflowConfigSidebar
        definition={localDefinition}
        nodeSpecs={nodeSpecs}
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
        onChangeNodeData={updateNodeData}
        onDeleteNode={deleteNode}
      />
    </div>
  )
}

function nextNodePosition(definition: AIWorkflowDefinition) {
  if (definition.nodes.length === 0) {
    return { x: 80, y: 80 }
  }
  const maxX = Math.max(...definition.nodes.map((node) => node.meta?.position?.x ?? 0))
  const minY = Math.min(...definition.nodes.map((node) => node.meta?.position?.y ?? 80))
  return { x: maxX + 320, y: Number.isFinite(minY) ? minY : 80 }
}
