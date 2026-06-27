"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  WorkflowDocument,
  WorkflowSelectService,
  type WorkflowJSON,
  type WorkflowNodeJSON,
  useClientContext,
  useService,
} from "@flowgram.ai/free-layout-editor"

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
  const [selectedNodeId, setSelectedNodeId] = useState(definition.nodes[0]?.id ?? "")

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

  return (
    <FreeLayoutEditorProvider {...editorProps}>
      <WorkflowEditorInner
        definition={localDefinition}
        nodeSpecs={nodeSpecs}
        selectedNodeId={selectedNodeId}
        validation={validation}
        toolbarExtra={toolbarExtra}
        onDefinitionChange={(next) => {
          setLocalDefinition(next)
          onDefinitionChange(next)
        }}
        onSelectNode={setSelectedNodeId}
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
    </FreeLayoutEditorProvider>
  )
}

function WorkflowEditorInner({
  definition,
  nodeSpecs,
  selectedNodeId,
  validation,
  toolbarExtra,
  onDefinitionChange,
  onSelectNode,
  onUndo,
  undoDisabled,
  onRedo,
  redoDisabled,
  onRestoreDefault,
  restoreDefaultDisabled,
  onValidate,
  validateDisabled,
  onSaveDraft,
  saveDraftDisabled,
  onPublish,
  publishDisabled,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  selectedNodeId: string
  validation: ReturnType<typeof validateWorkflowDefinition>
  toolbarExtra?: ReactNode
  onDefinitionChange: (definition: AIWorkflowDefinition) => void
  onSelectNode: (nodeId: string) => void
  onUndo?: () => void
  undoDisabled?: boolean
  onRedo?: () => void
  redoDisabled?: boolean
  onRestoreDefault?: () => void
  restoreDefaultDisabled?: boolean
  onValidate?: () => void
  validateDisabled?: boolean
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  onPublish?: () => void
  publishDisabled?: boolean
}) {
  const context = useClientContext()
  const workflowDocument = useService(WorkflowDocument)
  const selectService = useService(WorkflowSelectService)

  useEffect(() => {
    const disposable = selectService.onSelectionChanged(() => {
      const selectedNode = selectService.selectedNodes[0]
      if (selectedNode) {
        onSelectNode(selectedNode.id)
      }
    })
    return () => disposable.dispose()
  }, [onSelectNode, selectService])

  const emitCurrentDefinition = () => {
    onDefinitionChange(context.document.toJSON() as AIWorkflowDefinition)
  }

  const addNode = async (spec: AIWorkflowNodeSpec) => {
    const nextNode = createWorkflowNodeFromSpec(spec, definition.nodes, nextNodePosition(definition))
    const created = workflowDocument.createWorkflowNodeByType(
      spec.type,
      nextNode.meta?.position,
      nextNode as WorkflowNodeJSON
    )
    await selectService.selectNodeAndScrollToView(created)
    onSelectNode(created.id)
    emitCurrentDefinition()
  }

  const selectNode = (nodeId: string) => {
    const node = workflowDocument.getAllNodes().find((item) => item.id === nodeId)
    if (node) {
      selectService.selectNodeAndFocus(node)
    }
    onSelectNode(nodeId)
  }

  const updateNodeData = (nodeId: string, data: WorkflowNodeData) => {
    const next = updateWorkflowNodeData(definition, nodeId, data)
    context.operation.fromJSON(next as WorkflowJSON)
    onDefinitionChange(context.document.toJSON() as AIWorkflowDefinition)
  }

  const removeNode = (nodeId: string) => {
    const next = deleteWorkflowNode(definition, nodeId)
    context.operation.fromJSON(next as WorkflowJSON)
    const nextSelectedNodeId = next.nodes[0]?.id ?? ""
    onSelectNode(nextSelectedNodeId)
    onDefinitionChange(context.document.toJSON() as AIWorkflowDefinition)
  }

  return (
    <div className="relative isolate flex min-h-[640px] flex-1 overflow-hidden border bg-background">
      <WorkflowNodePalette nodeSpecs={nodeSpecs} onAddNode={addNode} />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkflowEditorToolbar
          validation={validation}
          nodeCount={definition.nodes.length}
          edgeCount={definition.edges.length}
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
          <EditorRenderer className="h-full w-full" />
        </div>
      </div>

      <WorkflowConfigSidebar
        definition={definition}
        nodeSpecs={nodeSpecs}
        selectedNodeId={selectedNodeId}
        onSelectNode={selectNode}
        onChangeNodeData={updateNodeData}
        onDeleteNode={removeNode}
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
