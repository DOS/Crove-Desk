"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import {
  EditorRenderer,
  FreeLayoutEditorProvider,
  WorkflowDocument,
  WorkflowLinesManager,
  WorkflowSelectService,
  type WorkflowJSON,
  type WorkflowNodeJSON,
  type WorkflowPortEntity,
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
import {
  WorkflowPortAddProvider,
  type WorkflowPortAddRequest,
} from "./workflow-port-add-context"
import {
  WorkflowPortNodeMenu,
  type WorkflowPortNodeMenuState,
} from "./workflow-port-node-menu"
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
  const linesManager = useService(WorkflowLinesManager)
  const selectService = useService(WorkflowSelectService)
  const editorRootRef = useRef<HTMLDivElement>(null)
  const [autoLayouting, setAutoLayouting] = useState(false)
  const [nodeMenu, setNodeMenu] = useState<(WorkflowPortNodeMenuState & { port: WorkflowPortEntity }) | null>(null)
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

  const openNodeMenuFromPort = useCallback((request: WorkflowPortAddRequest) => {
    const rootRect = editorRootRef.current?.getBoundingClientRect()
    setNodeMenu({
      port: request.port,
      x: rootRect ? request.event.clientX - rootRect.left + 10 : request.event.clientX,
      y: rootRect ? request.event.clientY - rootRect.top - 10 : request.event.clientY,
    })
  }, [])

  const addNodeFromPort = async (spec: AIWorkflowNodeSpec) => {
    if (!nodeMenu) {
      return
    }
    const sourcePort = nodeMenu.port
    const nextNode = createWorkflowNodeFromSpec(
      spec,
      context.document.toJSON().nodes ?? definition.nodes,
      nextNodePositionFromPort(sourcePort)
    )
    const created = workflowDocument.createWorkflowNodeByType(
      spec.type,
      nextNode.meta?.position,
      nextNode as WorkflowNodeJSON
    )
    linesManager.createLine({
      from: sourcePort.node.id,
      fromPort: sourcePort.portID,
      to: created.id,
      toPort: "",
    })
    setNodeMenu(null)
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
      ref={editorRootRef}
      data-workflow-editor-root
      className="relative isolate h-full min-h-0 w-full flex-1 overflow-hidden border bg-[var(--g-editor-background)]"
    >
      <div
        className={cn(
          "absolute left-3 top-3 z-50 max-w-[calc(100%-1.5rem)]",
          selectedNodeId && "max-w-[calc(100%-25rem)]"
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

      <WorkflowPortAddProvider onRequestAdd={openNodeMenuFromPort}>
        <EditorRenderer className="h-full w-full" />
      </WorkflowPortAddProvider>

      <WorkflowPortNodeMenu
        open={Boolean(nodeMenu)}
        position={nodeMenu}
        nodeSpecs={nodeSpecs}
        onSelect={(spec) => void addNodeFromPort(spec)}
        onClose={() => setNodeMenu(null)}
      />

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

function nextNodePositionFromPort(port: WorkflowPortEntity) {
  return {
    x: port.point.x + 120,
    y: port.point.y - 40,
  }
}
