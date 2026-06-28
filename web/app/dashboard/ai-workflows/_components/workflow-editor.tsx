"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  WorkflowDocument,
  WorkflowSelectService,
  type WorkflowJSON,
  type WorkflowNodeJSON,
  useClientContext,
  usePlaygroundTools,
  useService,
} from "@flowgram.ai/free-layout-editor"

import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import { cn } from "@/lib/utils"

import { useFlowgramEditorProps } from "./flowgram-editor-provider"
import {
  WorkflowBranchSelectionProvider,
  type SelectedWorkflowBranch,
} from "./workflow-branch-selection"
import { WorkflowConfigPanel } from "./workflow-config-sidebar"
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
  const [selectedNodeId, setSelectedNodeId] = useState("")
  const [selectedBranch, setSelectedBranch] = useState<SelectedWorkflowBranch | null>(null)
  const branchSelectAtRef = useRef(0)

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

  const handleSelectBranch = useCallback(
    (branch: SelectedWorkflowBranch | null) => {
      if (!branch) {
        setSelectedBranch(null)
        return
      }
      branchSelectAtRef.current = Date.now()
      setSelectedNodeId(branch.nodeId)
      setSelectedBranch(branch)
    },
    []
  )

  return (
    <WorkflowBranchSelectionProvider
      selectedBranch={selectedBranch}
      onSelectBranch={handleSelectBranch}
    >
      <FreeLayoutEditorProvider {...editorProps}>
        <WorkflowEditorInner
          definition={localDefinition}
          nodeSpecs={nodeSpecs}
          selectedNodeId={selectedNodeId}
          selectedBranch={selectedBranch}
          validation={validation}
          toolbarExtra={toolbarExtra}
          onDefinitionChange={(next) => {
            setLocalDefinition(next)
            onDefinitionChange(next)
          }}
          onSelectNode={(nodeId) => {
            setSelectedNodeId(nodeId)
            if (!nodeId || Date.now() - branchSelectAtRef.current > 160) {
              setSelectedBranch(null)
            }
          }}
          onSelectBranch={handleSelectBranch}
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
    </WorkflowBranchSelectionProvider>
  )
}

function WorkflowEditorInner({
  definition,
  nodeSpecs,
  selectedNodeId,
  selectedBranch,
  validation,
  toolbarExtra,
  onDefinitionChange,
  onSelectNode,
  onSelectBranch,
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
  selectedBranch: SelectedWorkflowBranch | null
  validation: ReturnType<typeof validateWorkflowDefinition>
  toolbarExtra?: ReactNode
  onDefinitionChange: (definition: AIWorkflowDefinition) => void
  onSelectNode: (nodeId: string) => void
  onSelectBranch: (branch: SelectedWorkflowBranch | null) => void
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
  const playgroundTools = usePlaygroundTools()
  const workflowDocument = useService(WorkflowDocument)
  const selectService = useService(WorkflowSelectService)
  const [autoLayouting, setAutoLayouting] = useState(false)
  const zoomPercent = `${Math.round(playgroundTools.zoom * 100)}%`

  useEffect(() => {
    const disposable = selectService.onSelectionChanged(() => {
      const selectedNode = selectService.selectedNodes[0]
      onSelectNode(selectedNode?.id ?? "")
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

  const autoLayout = async () => {
    if (autoLayouting || definition.nodes.length < 2) {
      return
    }
    setAutoLayouting(true)
    try {
      await playgroundTools.autoLayout({
        enableAnimation: true,
        animationDuration: 240,
        disableFitView: true,
      })
      playgroundTools.fitView(true)
      emitCurrentDefinition()
    } finally {
      setAutoLayouting(false)
    }
  }

  const resetZoom = () => {
    context.playground.config.updateConfig({
      zoom: 1,
    })
  }

  const closeConfigPanel = () => {
    selectService.clear()
    onSelectNode("")
    onSelectBranch(null)
  }

  return (
    <div
      data-workflow-editor-root
      className="relative isolate h-full min-h-0 w-full flex-1 overflow-hidden border bg-[var(--g-editor-background)]"
    >
      <WorkflowNodePalette nodeSpecs={nodeSpecs} onAddNode={addNode} />

      <div
        className={cn(
          "absolute left-[17.5rem] top-3 z-50 max-w-[calc(100%-18.25rem)]",
          selectedNodeId && "max-w-[calc(100%-41rem)]"
        )}
      >
        <WorkflowEditorToolbar
          validation={validation}
          nodeCount={definition.nodes.length}
          edgeCount={definition.edges.length}
          toolbarExtra={toolbarExtra}
          onUndo={onUndo}
          undoDisabled={undoDisabled}
          onRedo={onRedo}
          redoDisabled={redoDisabled}
          onAutoLayout={() => void autoLayout()}
          autoLayoutDisabled={autoLayouting || definition.nodes.length < 2}
          zoomPercent={zoomPercent}
          onZoomIn={() => playgroundTools.zoomin(true)}
          onZoomOut={() => playgroundTools.zoomout(true)}
          onResetZoom={resetZoom}
          onFitView={() => playgroundTools.fitView(true)}
          onRestoreDefault={onRestoreDefault}
          restoreDefaultDisabled={restoreDefaultDisabled}
          onValidate={onValidate}
          validateDisabled={validateDisabled}
          onSaveDraft={onSaveDraft}
          saveDraftDisabled={saveDraftDisabled}
          onPublish={onPublish}
          publishDisabled={publishDisabled}
        />
      </div>

      <EditorRenderer className="h-full w-full" />

      <WorkflowConfigPanel
        definition={definition}
        nodeSpecs={nodeSpecs}
        selectedNodeId={selectedNodeId}
        selectedBranch={selectedBranch}
        onClose={closeConfigPanel}
        onSelectBranch={onSelectBranch}
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
