"use client"

import "@xyflow/react/dist/style.css"

import {
  addEdge,
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  Position,
  ReactFlow,
  ViewportPortal,
  useEdgesState,
  useNodesState,
  type Connection,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type FinalConnectionState,
  type Node,
  type NodeChange,
  type OnNodeDrag,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircle2Icon,
  CircleStopIcon,
  DatabaseIcon,
  GitBranchIcon,
  MessageSquareTextIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlayIcon,
  PlusIcon,
  Redo2Icon,
  RotateCcwIcon,
  SaveIcon,
  SendIcon,
  Undo2Icon,
  UserRoundIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import {
  applyConditionBranchConnection,
  applyAutoInputMappings,
  calculateWorkflowHelperLines,
  clearConditionBranchConnection,
  createWorkflowHistory,
  createWorkflowNodeFromSpec,
  fromApiDefinition,
  getAvailableVariables,
  getConditionBranchHandleId,
  getNodeSpec,
  getRequiredInputs,
  pushWorkflowHistory,
  redoWorkflowHistory,
  toApiDefinition,
  undoWorkflowHistory,
  validateWorkflowDraft,
  type WorkflowCondition,
  type WorkflowDraft,
  type WorkflowEditorNode,
  type WorkflowHistory,
  type WorkflowHelperLine,
  type WorkflowNodeConfig,
  type WorkflowVariableSpec,
} from "./workflow-utils"
import { NodeConfigPanel, type WorkflowBranchSummary } from "./node-config-panel"

type WorkflowNodeData = Record<string, unknown> & {
  nodeType?: string
  name?: string
  config?: WorkflowNodeConfig
  inputs?: Record<string, { nodeId: string; field: string }>
  nodeSpecs?: AIWorkflowNodeSpec[]
  onAddAfter?: (sourceNodeId: string, spec: AIWorkflowNodeSpec) => void
  label?: string
  title?: string
  description?: string
  inputCount?: number
  outputCount?: number
  missingInputs?: string[]
  branchSummaries?: WorkflowBranchSummary[]
}

type WorkflowFlowNode = Node<WorkflowNodeData>
type WorkflowFlowEdge = Edge
type WorkflowEditorSnapshot = {
  nodes: WorkflowFlowNode[]
  edges: WorkflowFlowEdge[]
}
type WorkflowEdgeRenderData = {
  active?: boolean
  nodeSpecs?: AIWorkflowNodeSpec[]
  onInsertNode?: (edgeId: string, spec: AIWorkflowNodeSpec) => void
}
type WorkflowFinalConnectionState = FinalConnectionState

type PendingNodeDrag = {
  spec: AIWorkflowNodeSpec
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
}

const nodeTypes = {
  workflowNode: WorkflowCanvasNode,
}

const edgeTypes = {
  workflowEdge: WorkflowCanvasEdge,
}

const fitViewOptions = {
  padding: 0.16,
  minZoom: 0.72,
  maxZoom: 1,
}

const defaultEdgeOptions = {
  type: "workflowEdge",
  style: {
    strokeWidth: 2,
  },
}

function toFlowNodes(definition: AIWorkflowDefinition): WorkflowFlowNode[] {
  return fromApiDefinition(definition).nodes.map((node) => ({
    id: node.id,
    type: "workflowNode",
    position: node.position,
    data: {
      nodeType: node.data?.nodeType ?? node.type,
      name: node.data?.name ?? node.id,
      label: node.data?.name ?? node.type ?? node.id,
      config: node.data?.config ?? {},
      inputs: node.data?.inputs ?? {},
    },
  }))
}

function toFlowEdges(definition: AIWorkflowDefinition): WorkflowFlowEdge[] {
  return (definition.edges ?? []).map((edge) => ({
    id: edge.id,
    type: "workflowEdge",
    source: edge.source,
    target: edge.target,
    sourceHandle: getConditionBranchHandleForEdge(definition, edge.source, edge.target),
  }))
}

function getConditionBranchHandleForEdge(
  definition: AIWorkflowDefinition,
  sourceNodeId: string,
  targetNodeId: string
) {
  const sourceNode = definition.nodes?.find((node) => node.id === sourceNodeId)
  if (!sourceNode || sourceNode.type !== "condition") {
    return undefined
  }
  const config = sourceNode.config as WorkflowNodeConfig | undefined
  const branch = config?.branches?.find((item) => item.targetNodeId === targetNodeId)
  return branch ? getConditionBranchHandleId(branch.id) : undefined
}

function toDraft(nodes: WorkflowFlowNode[], edges: WorkflowFlowEdge[]): WorkflowDraft {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        nodeType: node.data.nodeType,
        name: node.data.name,
        config: node.data.config,
        inputs: node.data.inputs,
      },
    })) as WorkflowEditorNode[],
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    })),
  }
}

export function WorkflowEditor({
  definition,
  nodeSpecs,
  onDefinitionChange,
  onRestoreDefault,
  restoreDefaultDisabled = false,
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
  onValidate?: () => void
  validateDisabled?: boolean
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  onPublish?: () => void
  publishDisabled?: boolean
  toolbarExtra?: ReactNode
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(
    toFlowNodes(definition)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowFlowEdge>(
    toFlowEdges(definition)
  )
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null)
  const [nodeLibraryCollapsed, setNodeLibraryCollapsed] = useState(false)
  const [nodeLibraryRendered, setNodeLibraryRendered] = useState(true)
  const [nodeLibraryVisible, setNodeLibraryVisible] = useState(true)
  const [nodeLibraryWidth, setNodeLibraryWidth] = useState(260)
  const [nodeLibraryResizing, setNodeLibraryResizing] = useState(false)
  const [pendingNodeDrag, setPendingNodeDrag] = useState<PendingNodeDrag | null>(null)
  const [helperLines, setHelperLines] = useState<WorkflowHelperLine>({})
  const [propertyPanelNode, setPropertyPanelNode] = useState<WorkflowFlowNode | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [propertyPanelVisible, setPropertyPanelVisible] = useState(false)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLElement | null>(null)
  const pendingNodeDragRef = useRef<PendingNodeDrag | null>(null)
  const historyRef = useRef<WorkflowHistory<WorkflowEditorSnapshot>>(createWorkflowHistory())
  const dragStartSnapshotRef = useRef<WorkflowEditorSnapshot | null>(null)
  const suppressNextClickRef = useRef(false)
  const nodeLibraryAnimationTimerRef = useRef<number | null>(null)
  const propertyPanelAnimationTimerRef = useRef<number | null>(null)
  const draft = useMemo(() => toDraft(nodes, edges), [nodes, edges])
  const [historyAvailability, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  })
  const validation = useMemo(
    () => validateWorkflowDraft(draft, nodeSpecs),
    [draft, nodeSpecs]
  )
  const propertyPanelNodeSpec = useMemo(
    () => getNodeSpec(nodeSpecs, propertyPanelNode?.data.nodeType ?? ""),
    [nodeSpecs, propertyPanelNode]
  )
  const propertyPanelAvailableVariables = useMemo(
    () => (propertyPanelNode ? getAvailableVariables(draft, propertyPanelNode.id, nodeSpecs) : []),
    [draft, nodeSpecs, propertyPanelNode]
  )
  const propertyPanelBranchSummaries = useMemo(
    () => (propertyPanelNode ? getBranchSummaries(nodes, propertyPanelNode.id, nodeSpecs) : []),
    [nodeSpecs, nodes, propertyPanelNode]
  )
  useEffect(() => {
    onDefinitionChange(toApiDefinition(draft) as AIWorkflowDefinition)
  }, [draft, onDefinitionChange])

  useEffect(() => {
    return () => {
      if (nodeLibraryAnimationTimerRef.current !== null) {
        window.clearTimeout(nodeLibraryAnimationTimerRef.current)
      }
      if (propertyPanelAnimationTimerRef.current !== null) {
        window.clearTimeout(propertyPanelAnimationTimerRef.current)
      }
    }
  }, [])

  const showNodeLibrary = useCallback(() => {
    if (nodeLibraryAnimationTimerRef.current !== null) {
      window.clearTimeout(nodeLibraryAnimationTimerRef.current)
    }
    setNodeLibraryCollapsed(false)
    setNodeLibraryRendered(true)
    nodeLibraryAnimationTimerRef.current = window.setTimeout(() => {
      setNodeLibraryVisible(true)
      nodeLibraryAnimationTimerRef.current = null
    }, 0)
  }, [])

  const hideNodeLibrary = useCallback(() => {
    if (nodeLibraryAnimationTimerRef.current !== null) {
      window.clearTimeout(nodeLibraryAnimationTimerRef.current)
    }
    setNodeLibraryCollapsed(true)
    setNodeLibraryVisible(false)
    nodeLibraryAnimationTimerRef.current = window.setTimeout(() => {
      setNodeLibraryRendered(false)
      nodeLibraryAnimationTimerRef.current = null
    }, 220)
  }, [])

  const showPropertyPanelNode = useCallback((node: WorkflowFlowNode) => {
    if (propertyPanelAnimationTimerRef.current !== null) {
      window.clearTimeout(propertyPanelAnimationTimerRef.current)
    }
    setPropertyPanelNode(node)
    propertyPanelAnimationTimerRef.current = window.setTimeout(() => {
      setPropertyPanelVisible(true)
      propertyPanelAnimationTimerRef.current = null
    }, 0)
  }, [])

  const hidePropertyPanel = useCallback(() => {
    if (propertyPanelAnimationTimerRef.current !== null) {
      window.clearTimeout(propertyPanelAnimationTimerRef.current)
    }
    setPropertyPanelVisible(false)
    propertyPanelAnimationTimerRef.current = window.setTimeout(() => {
      setPropertyPanelNode(null)
      propertyPanelAnimationTimerRef.current = null
    }, 220)
  }, [])

  const syncHistoryAvailability = useCallback(() => {
    setHistoryAvailability({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    })
  }, [])

  const getCurrentSnapshot = useCallback((): WorkflowEditorSnapshot => ({
    nodes,
    edges,
  }), [edges, nodes])

  const pushSnapshotToHistory = useCallback(
    (snapshot: WorkflowEditorSnapshot) => {
      historyRef.current = pushWorkflowHistory(historyRef.current, snapshot)
      syncHistoryAvailability()
    },
    [syncHistoryAvailability]
  )

  const pushCurrentSnapshotToHistory = useCallback(() => {
    pushSnapshotToHistory(getCurrentSnapshot())
  }, [getCurrentSnapshot, pushSnapshotToHistory])

  const applySnapshot = useCallback(
    (snapshot: WorkflowEditorSnapshot) => {
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      setHelperLines({})
      setSelectedEdgeId((current) =>
        current && snapshot.edges.some((edge) => edge.id === current) ? current : null
      )
      setPropertyPanelNode((current) =>
        current ? snapshot.nodes.find((node) => node.id === current.id) ?? null : null
      )
    },
    [setEdges, setNodes]
  )

  const undoWorkflowEdit = useCallback(() => {
    const result = undoWorkflowHistory(historyRef.current, getCurrentSnapshot())
    if (!result) {
      return
    }
    historyRef.current = result.history
    applySnapshot(result.snapshot)
    syncHistoryAvailability()
  }, [applySnapshot, getCurrentSnapshot, syncHistoryAvailability])

  const redoWorkflowEdit = useCallback(() => {
    const result = redoWorkflowHistory(historyRef.current, getCurrentSnapshot())
    if (!result) {
      return
    }
    historyRef.current = result.history
    applySnapshot(result.snapshot)
    syncHistoryAvailability()
  }, [applySnapshot, getCurrentSnapshot, syncHistoryAvailability])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return
      }
      if (isEditableKeyboardTarget(event.target)) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === "z" && event.shiftKey) {
        event.preventDefault()
        redoWorkflowEdit()
        return
      }
      if (key === "y") {
        event.preventDefault()
        redoWorkflowEdit()
        return
      }
      if (key === "z") {
        event.preventDefault()
        undoWorkflowEdit()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [redoWorkflowEdit, undoWorkflowEdit])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }
      pushCurrentSnapshotToHistory()
      const edge = {
        ...connection,
        id: uniqueEdgeId(edges, connection.source, connection.target, connection.sourceHandle),
        type: "workflowEdge",
      } as WorkflowFlowEdge
      const nextEdges = [
        ...edges.filter((item) => !(
          connection.sourceHandle
          && item.source === connection.source
          && item.sourceHandle === connection.sourceHandle
        )),
        edge,
      ]
      setEdges((current) => addEdge(edge, current.filter((item) => !(
        connection.sourceHandle
        && item.source === connection.source
        && item.sourceHandle === connection.sourceHandle
      ))))
      setNodes((currentNodes) => {
        const connectedDraft = applyConditionBranchConnection(
          toDraft(currentNodes, nextEdges),
          edge
        )
        const nextDraft = applyAutoInputMappings(connectedDraft, connection.source!, connection.target!, nodeSpecs)
        return currentNodes.map((node) => {
          const nextNode = nextDraft.nodes.find((item) => item.id === node.id)
          if (!nextNode) {
            return node
          }
          return {
            ...node,
            data: {
              ...node.data,
              config: nextNode.data?.config ?? node.data.config,
              inputs: nextNode.data?.inputs ?? node.data.inputs,
            },
          }
        })
      })
    },
    [edges, nodeSpecs, pushCurrentSnapshotToHistory, setEdges, setNodes]
  )

  const connectToNode = useCallback(
    (connectionState: WorkflowFinalConnectionState, targetNodeId: string) => {
      if (!connectionState.fromHandle || connectionState.toHandle || connectionState.fromHandle.nodeId === targetNodeId) {
        return
      }

      const fromHandle = connectionState.fromHandle
      const source = fromHandle.type === "target" ? targetNodeId : fromHandle.nodeId
      const target = fromHandle.type === "target" ? fromHandle.nodeId : targetNodeId
      const connection = {
        source,
        target,
        sourceHandle: fromHandle.type === "target" ? null : fromHandle.id ?? null,
        targetHandle: fromHandle.type === "target" ? fromHandle.id ?? null : null,
      } satisfies Connection
      onConnect(connection)
    },
    [onConnect]
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: WorkflowFinalConnectionState) => {
      if (connectionState.toHandle) {
        return
      }
      const point = getEventClientPoint(event)
      if (!point) {
        return
      }
      const nodeElement = document
        .elementFromPoint(point.x, point.y)
        ?.closest<HTMLElement>(".react-flow__node[data-id]")
      const targetNodeId = nodeElement?.dataset.id
      if (!targetNodeId) {
        return
      }
      connectToNode(connectionState, targetNodeId)
    },
    [connectToNode]
  )

  const onWorkflowNodesChange = useCallback(
    (changes: NodeChange<WorkflowFlowNode>[]) => {
      if (changes.some((change) => change.type === "remove")) {
        pushCurrentSnapshotToHistory()
      }
      onNodesChange(changes)
    },
    [onNodesChange, pushCurrentSnapshotToHistory]
  )

  const onWorkflowEdgesChange = useCallback(
    (changes: EdgeChange<WorkflowFlowEdge>[]) => {
      const removedEdges = changes
        .filter((change) => change.type === "remove")
        .map((change) => edges.find((edge) => edge.id === change.id))
        .filter((edge): edge is WorkflowFlowEdge => Boolean(edge))
      if (removedEdges.length > 0) {
        pushCurrentSnapshotToHistory()
        setNodes((currentNodes) => {
          let draft = toDraft(currentNodes, edges.filter((edge) => !removedEdges.some((removed) => removed.id === edge.id)))
          for (const removedEdge of removedEdges) {
            draft = clearConditionBranchConnection(draft, {
              id: removedEdge.id,
              source: removedEdge.source,
              target: removedEdge.target,
              sourceHandle: removedEdge.sourceHandle,
              targetHandle: removedEdge.targetHandle,
            })
          }
          return currentNodes.map((node) => {
            const nextNode = draft.nodes.find((item) => item.id === node.id)
            if (!nextNode) {
              return node
            }
            return {
              ...node,
              data: {
                ...node.data,
                config: nextNode.data?.config ?? node.data.config,
              },
            }
          })
        })
      }
      onEdgesChange(changes)
    },
    [edges, onEdgesChange, pushCurrentSnapshotToHistory, setNodes]
  )

  const onNodeDragStart = useCallback<OnNodeDrag<WorkflowFlowNode>>(() => {
    dragStartSnapshotRef.current = getCurrentSnapshot()
  }, [getCurrentSnapshot])

  const onNodeDrag = useCallback<OnNodeDrag<WorkflowFlowNode>>(
    (_event, node) => {
      const nextHelperLines = calculateWorkflowHelperLines(nodes, node)
      setHelperLines({
        horizontal: nextHelperLines.horizontal,
        vertical: nextHelperLines.vertical,
      })
      if (
        nextHelperLines.position.x === node.position.x &&
        nextHelperLines.position.y === node.position.y
      ) {
        return
      }
      setNodes((current) =>
        current.map((item) =>
          item.id === node.id
            ? {
                ...item,
                position: nextHelperLines.position,
              }
            : item
        )
      )
    },
    [nodes, setNodes]
  )

  const onNodeDragStop = useCallback<OnNodeDrag<WorkflowFlowNode>>((_event, node) => {
    setHelperLines({})
    const startSnapshot = dragStartSnapshotRef.current
    dragStartSnapshotRef.current = null
    const startNode = startSnapshot?.nodes.find((item) => item.id === node.id)
    if (
      startSnapshot &&
      startNode &&
      (startNode.position.x !== node.position.x || startNode.position.y !== node.position.y)
    ) {
      pushSnapshotToHistory(startSnapshot)
    }
  }, [pushSnapshotToHistory])

  const addNode = (spec: AIWorkflowNodeSpec) => {
    pushCurrentSnapshotToHistory()
    setNodes((current) => {
      const node = createWorkflowNodeFromSpec(
        spec,
        current,
        { x: 120 + current.length * 28, y: 100 + current.length * 24 }
      ) as WorkflowFlowNode
      return [
        ...current,
        {
          ...node,
          data: {
            ...node.data,
          },
        },
      ]
    })
  }

  const addNodeAfter = useCallback(
    (sourceNodeId: string, spec: AIWorkflowNodeSpec) => {
      pushCurrentSnapshotToHistory()
      setNodes((current) => {
        const sourceNode = current.find((node) => node.id === sourceNodeId)
        const nextPosition = sourceNode
          ? { x: sourceNode.position.x + 280, y: sourceNode.position.y }
          : { x: 160 + current.length * 32, y: 120 + current.length * 24 }
        const nextNode = createWorkflowNodeFromSpec(
          spec,
          current,
          nextPosition
        ) as WorkflowFlowNode

        setEdges((currentEdges) => [
          ...currentEdges,
          {
            id: uniqueEdgeId(currentEdges, sourceNodeId, nextNode.id),
            source: sourceNodeId,
            target: nextNode.id,
            type: "workflowEdge",
          },
        ])

        return [...current, nextNode]
      })
    },
    [pushCurrentSnapshotToHistory, setEdges, setNodes]
  )

  const insertNodeOnEdge = useCallback(
    (edgeId: string, spec: AIWorkflowNodeSpec) => {
      const edge = edges.find((item) => item.id === edgeId)
      if (!edge) {
        return
      }
      pushCurrentSnapshotToHistory()
      const remainingEdges = edges.filter((item) => item.id !== edge.id)
      setNodes((currentNodes) => {
        const sourceNode = currentNodes.find((node) => node.id === edge.source)
        const targetNode = currentNodes.find((node) => node.id === edge.target)
        const nextPosition = sourceNode && targetNode
          ? {
              x: (sourceNode.position.x + targetNode.position.x) / 2,
              y: (sourceNode.position.y + targetNode.position.y) / 2,
            }
          : { x: 180 + currentNodes.length * 32, y: 120 + currentNodes.length * 24 }
        const nextNode = createWorkflowNodeFromSpec(spec, currentNodes, nextPosition) as WorkflowFlowNode
        const sourceToNew = {
          id: uniqueEdgeId(remainingEdges, edge.source, nextNode.id, edge.sourceHandle),
          source: edge.source,
          target: nextNode.id,
          sourceHandle: edge.sourceHandle,
          type: "workflowEdge",
        } as WorkflowFlowEdge
        const newToTarget = {
          id: uniqueEdgeId([...remainingEdges, sourceToNew], nextNode.id, edge.target),
          source: nextNode.id,
          target: edge.target,
          targetHandle: edge.targetHandle,
          type: "workflowEdge",
        } as WorkflowFlowEdge
        const nextEdges = [...remainingEdges, sourceToNew, newToTarget]
        let nextDraft = applyConditionBranchConnection(
          toDraft([...currentNodes, nextNode], nextEdges),
          sourceToNew
        )
        nextDraft = applyAutoInputMappings(nextDraft, edge.source, nextNode.id, nodeSpecs)
        nextDraft = applyAutoInputMappings(nextDraft, nextNode.id, edge.target, nodeSpecs)
        setEdges(nextEdges)
        return [...currentNodes, nextNode].map((node) => {
          const draftNode = nextDraft.nodes.find((item) => item.id === node.id)
          if (!draftNode) {
            return node
          }
          return {
            ...node,
            data: {
              ...node.data,
              config: draftNode.data?.config ?? node.data.config,
              inputs: draftNode.data?.inputs ?? node.data.inputs,
            },
          }
        })
      })
    },
    [edges, nodeSpecs, pushCurrentSnapshotToHistory, setEdges, setNodes]
  )

  const renderedNodes = useMemo(
    () =>
      enrichNodesForRender(nodes, nodeSpecs).map((node) => ({
        ...node,
        data: {
          ...node.data,
          nodeSpecs,
          onAddAfter: addNodeAfter,
        },
      })),
    [addNodeAfter, nodes, nodeSpecs]
  )

  const dropNodeOnCanvas = useCallback(
    (spec: AIWorkflowNodeSpec, x: number, y: number) => {
      if (!flowInstance || !canvasRef.current) {
        return false
      }
      const rect = canvasRef.current.getBoundingClientRect()
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return false
      }
      pushCurrentSnapshotToHistory()
      const position = flowInstance.screenToFlowPosition({ x, y })
      setNodes((current) => [
        ...current,
        createWorkflowNodeFromSpec(spec, current, position) as WorkflowFlowNode,
      ])
      return true
    },
    [flowInstance, pushCurrentSnapshotToHistory, setNodes]
  )

  const onNodePointerDown = (event: React.PointerEvent<HTMLButtonElement>, spec: AIWorkflowNodeSpec) => {
    if (event.button !== 0) {
      return
    }
    const initialDrag = {
      spec,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
    }
    pendingNodeDragRef.current = initialDrag
    setPendingNodeDrag(initialDrag)

    const handlePointerMove = (event: PointerEvent) => {
      const current = pendingNodeDragRef.current
      if (!current) {
        return
      }
      const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY)
      const nextDrag = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        active: current.active || moved > 6,
      }
      pendingNodeDragRef.current = nextDrag
      setPendingNodeDrag(nextDrag)
    }

    const handlePointerUp = (event: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      const current = pendingNodeDragRef.current
      pendingNodeDragRef.current = null
      setPendingNodeDrag(null)
      if (current?.active) {
        suppressNextClickRef.current = true
        dropNodeOnCanvas(current.spec, event.clientX, event.clientY)
      }
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }

  const updateNodeData = (nodeId: string, data: WorkflowNodeData) => {
    pushCurrentSnapshotToHistory()
    const nextData = {
      ...data,
      label: data.name ?? data.nodeType ?? nodeId,
    }
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: nextData,
            }
          : node
      )
    )
    setPropertyPanelNode((current) =>
      current?.id === nodeId
        ? {
            ...current,
            data: nextData,
          }
        : current
    )
  }

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const active = edge.id === selectedEdgeId
        return {
          ...edge,
          selected: active,
          data: {
            active,
            nodeSpecs,
            onInsertNode: insertNodeOnEdge,
          } satisfies WorkflowEdgeRenderData,
        }
      }),
    [edges, insertNodeOnEdge, nodeSpecs, selectedEdgeId]
  )

  const clampNodeLibraryWidth = useCallback((width: number) => {
    const containerWidth = editorRef.current?.getBoundingClientRect().width ?? 0
    const maxWidth = containerWidth > 0 ? containerWidth * 0.34 : 520
    return Math.min(maxWidth, Math.max(192, width))
  }, [])

  const onNodeLibraryResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    const startX = event.clientX
    const startWidth = nodeLibraryWidth
    setNodeLibraryResizing(true)

    const handlePointerMove = (event: PointerEvent) => {
      setNodeLibraryWidth(clampNodeLibraryWidth(startWidth + event.clientX - startX))
    }

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      setNodeLibraryResizing(false)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }

  return (
    <div ref={editorRef} className="flex h-full min-h-0 w-full bg-[#f2f4f7]">
      {nodeLibraryRendered ? (
        <>
          <div
            className={cn(
              "h-full min-h-0 shrink-0 overflow-hidden transition-[width,opacity,transform] duration-200 ease-out",
              nodeLibraryResizing && "transition-none",
              nodeLibraryVisible
                ? "translate-x-0 opacity-100"
                : "-translate-x-3 opacity-0"
            )}
            style={{ width: nodeLibraryVisible ? nodeLibraryWidth : 0 }}
          >
            <aside
              className={[
                "h-full min-h-0 border-r border-border/60 bg-background/95 shadow-sm transition-all duration-200 ease-out",
                nodeLibraryVisible
                  ? "translate-x-0 opacity-100"
                  : "-translate-x-3 opacity-0",
              ].join(" ")}
            >
              <ScrollArea className="h-full min-h-0">
                <div className="p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-semibold uppercase">节点库</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={hideNodeLibrary}
                      aria-label="折叠节点库"
                    >
                      <PanelLeftCloseIcon className="size-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {nodeSpecs.map((spec) => (
                      <button
                        key={spec.type}
                        type="button"
                        onPointerDown={(event) => onNodePointerDown(event, spec)}
                        onClick={() => {
                          if (suppressNextClickRef.current) {
                            suppressNextClickRef.current = false
                            return
                          }
                          addNode(spec)
                        }}
                        className="group flex w-full cursor-grab rounded-xl border border-transparent bg-muted/55 px-3 py-2 text-left text-sm shadow-xs transition-all hover:border-primary/20 hover:bg-background hover:shadow-sm active:cursor-grabbing"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{spec.title}</span>
                          <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {spec.description}
                          </span>
                          <span className="mt-1 flex gap-2 text-[11px] text-muted-foreground">
                            <span className="rounded-md bg-background px-1.5 py-0.5">输入 {spec.inputSchema?.length ?? 0}</span>
                            <span className="rounded-md bg-background px-1.5 py-0.5">输出 {spec.outputSchema?.length ?? 0}</span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </aside>
          </div>
          <div
            className={cn(
              "relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-opacity duration-200 ease-out hover:bg-primary/20",
              nodeLibraryVisible ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            onPointerDown={onNodeLibraryResizePointerDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整节点库宽度"
          >
            <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
          </div>
        </>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1">
        <section
          data-workflow-canvas
          ref={canvasRef}
          className={[
            "relative h-full min-h-0 overflow-hidden bg-[#f2f4f7]",
            pendingNodeDrag?.active ? "ring-2 ring-primary/30" : "",
          ].join(" ")}
        >
          {nodeLibraryCollapsed ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-12 left-3 z-20 size-7 rounded-full bg-background/95 text-muted-foreground shadow-sm hover:text-foreground"
              onClick={showNodeLibrary}
              aria-label="展开节点库"
            >
              <PanelLeftOpenIcon className="size-3.5" />
            </Button>
          ) : null}
          <ReactFlow
            nodes={renderedNodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineComponent={WorkflowConnectionLine}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={34}
            connectOnClick
            onNodesChange={onWorkflowNodesChange}
            onEdgesChange={onWorkflowEdgesChange}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onInit={setFlowInstance}
            onNodeClick={(event, node) => {
              event.stopPropagation()
              setSelectedEdgeId(null)
              showPropertyPanelNode(node)
            }}
            onEdgeClick={(event, edge) => {
              event.stopPropagation()
              setSelectedEdgeId(edge.id)
            }}
            onPaneClick={() => {
              setSelectedEdgeId(null)
              hidePropertyPanel()
            }}
            fitView
            fitViewOptions={fitViewOptions}
            minZoom={0.45}
            maxZoom={1.35}
          >
            <Background
              gap={[14, 14]}
              size={2}
              color="rgb(133 133 173 / 0.15)"
              className="bg-[#f2f4f7]"
            />
            <Controls
              className="!bottom-4 !left-4 overflow-hidden !rounded-xl !border !border-border/70 !bg-background/90 !shadow-lg backdrop-blur"
              showInteractive={false}
            />
            <WorkflowHelperLines lines={helperLines} />
          </ReactFlow>
          <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
            <WorkflowCanvasToolbar
              validationErrors={validation.errors}
              validationValid={validation.valid}
              onValidate={onValidate}
              validateDisabled={validateDisabled}
              onSaveDraft={onSaveDraft}
              saveDraftDisabled={saveDraftDisabled}
              onPublish={onPublish}
              publishDisabled={publishDisabled}
              canUndo={historyAvailability.canUndo}
              canRedo={historyAvailability.canRedo}
              onUndo={undoWorkflowEdit}
              onRedo={redoWorkflowEdit}
              onRestoreDefault={onRestoreDefault}
              restoreDefaultDisabled={restoreDefaultDisabled}
              toolbarExtra={toolbarExtra}
            />
          </div>
          {propertyPanelNode ? (
            <aside
              className={[
                "absolute top-3 right-3 z-30 h-[calc(100%-1.5rem)] w-[min(420px,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-border/70 bg-background shadow-xl transition-all duration-200 ease-out",
                propertyPanelVisible
                  ? "translate-x-0 scale-100 opacity-100"
                  : "translate-x-3 scale-[0.98] opacity-0",
              ].join(" ")}
            >
              <ScrollArea className="h-full min-h-0">
                {propertyPanelNode ? (
                  <NodeConfigPanel
                    node={propertyPanelNode}
                    nodeSpec={propertyPanelNodeSpec}
                    availableVariables={propertyPanelAvailableVariables}
                    branchSummaries={propertyPanelBranchSummaries}
                    onChange={updateNodeData}
                  />
                ) : null}
                {!validation.valid ? (
                  <div className="border-t p-4">
                    <div className="mb-2 text-sm font-medium">流程检查</div>
                    <ul className="space-y-1 text-xs text-destructive">
                      {validation.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </ScrollArea>
            </aside>
          ) : null}
          {pendingNodeDrag?.active ? (
            <div
              className="pointer-events-none fixed z-50 rounded-xl border border-primary/20 bg-background px-3 py-2 text-sm font-medium shadow-lg"
              style={{
                left: pendingNodeDrag.x + 12,
                top: pendingNodeDrag.y + 12,
              }}
            >
              {pendingNodeDrag.spec.title}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function uniqueEdgeId(edges: WorkflowFlowEdge[], source: string, target: string, sourceHandle?: string | null) {
  let nextIndex = edges.length + 1
  const handleSuffix = sourceHandle ? `_${sourceHandle.replace(/[^a-zA-Z0-9_-]/g, "_")}` : ""
  let id = `edge_${source}${handleSuffix}_${target}_${nextIndex}`
  while (edges.some((edge) => edge.id === id)) {
    nextIndex += 1
    id = `edge_${source}${handleSuffix}_${target}_${nextIndex}`
  }
  return id
}

function enrichNodesForRender(
  nodes: WorkflowFlowNode[],
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowFlowNode[] {
  return nodes.map((node) => {
    const spec = getNodeSpec(nodeSpecs, node.data.nodeType ?? "")
    const missingInputs = getRequiredInputs(spec).filter((input) => {
      const selector = node.data.inputs?.[input.name]
      return !selector?.nodeId || !selector.field
    })
    return {
      ...node,
      data: {
        ...node.data,
        title: spec?.title ?? node.data.name ?? node.id,
        description: spec?.description ?? "",
        inputCount: spec?.inputSchema?.length ?? 0,
        outputCount: spec?.outputSchema?.length ?? 0,
        missingInputs: missingInputs.map((input) => input.name),
        branchSummaries: node.data.nodeType === "condition" ? getBranchSummaries(nodes, node.id, nodeSpecs) : undefined,
      },
    }
  })
}

const conditionOperators = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "exists", label: "存在" },
  { value: "not_exists", label: "不存在" },
  { value: "truthy", label: "为真" },
  { value: "is_true", label: "为真" },
  { value: "falsy", label: "为假" },
  { value: "is_false", label: "为假" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
]

function getBranchSummaries(
  nodes: WorkflowFlowNode[],
  nodeId: string,
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowBranchSummary[] {
  const node = nodes.find((item) => item.id === nodeId)
  const branches = node?.data.config?.branches ?? []
  return branches
    .map((branch) => {
      const target = nodes.find((item) => item.id === branch.targetNodeId)
      return {
        branchId: branch.id,
        targetNodeId: branch.targetNodeId,
        targetName: target?.data.name ?? target?.data.title ?? branch.targetNodeId,
        conditionLabel: branch.condition ? formatConditionLabel(branch.condition, nodes, nodeSpecs) : "无条件匹配",
        conditionSet: Boolean(branch.default || (branch.condition && isConditionConfigured(branch.condition))),
        isDefault: Boolean(branch.default),
      }
    })
}

function formatConditionLabel(
  condition: WorkflowCondition,
  nodes: WorkflowFlowNode[],
  nodeSpecs: AIWorkflowNodeSpec[]
) {
  const variable = findConditionOutputSpec(condition.left, nodes, nodeSpecs)
  const left = variable?.label
    ?? (condition.left?.nodeId && condition.left.field ? `${condition.left.nodeId}.${condition.left.field}` : "未选择变量")
  const operator = conditionOperators.find((item) => item.value === condition.operator)?.label
    ?? condition.operator
    ?? "未选择判断方式"

  if (["exists", "not_exists", "truthy", "is_true", "falsy", "is_false"].includes(condition.operator ?? "")) {
    return `${left} ${operator}`
  }

  return `${left} ${operator} ${formatConditionRight(condition.right, variable)}`
}

function isConditionConfigured(condition: WorkflowCondition) {
  if (!condition.left?.nodeId || !condition.left.field || !condition.operator) {
    return false
  }
  if (["exists", "not_exists", "truthy", "is_true", "falsy", "is_false"].includes(condition.operator)) {
    return true
  }
  return condition.right !== undefined && condition.right !== null && condition.right !== ""
}

function formatConditionRight(value: unknown, variable?: WorkflowVariableSpec) {
  if (value === undefined || value === null || value === "") {
    return "未填写比较值"
  }
  const option = variable?.valueOptions?.find((item) => conditionValueEquals(item.value, value))
  if (option) {
    return option.label
  }
  if (variable?.type === "boolean") {
    return value === true ? "是" : "否"
  }
  if (typeof value === "object") {
    return JSON.stringify(value)
  }
  return String(value)
}

function findConditionOutputSpec(
  selector: WorkflowCondition["left"],
  nodes: WorkflowFlowNode[],
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowVariableSpec | undefined {
  if (!selector?.nodeId || !selector.field) {
    return undefined
  }
  const sourceNode = nodes.find((item) => item.id === selector.nodeId)
  if (!sourceNode) {
    return undefined
  }
  const spec = getNodeSpec(nodeSpecs, sourceNode.data.nodeType ?? "")
  return spec?.outputSchema?.find((item) => item.name === selector.field)
}

function conditionValueEquals(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function getEventClientPoint(event: MouseEvent | TouchEvent) {
  if ("changedTouches" in event) {
    const touch = event.changedTouches[0] ?? event.touches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return { x: event.clientX, y: event.clientY }
}

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) {
    return true
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
}

function WorkflowConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  toHandle,
}: ConnectionLineComponentProps) {
  const [edgePath] = getBezierPath({
    sourceX: fromX - 8,
    sourceY: fromY,
    sourcePosition: fromPosition ?? Position.Right,
    targetX: toX + (toHandle ? 8 : 0),
    targetY: toY,
    targetPosition: toPosition ?? Position.Left,
    curvature: 0.16,
  })

  return (
    <g>
      <path
        fill="none"
        stroke="var(--primary)"
        opacity={0.7}
        strokeDasharray="8 8"
        strokeLinecap="round"
        strokeWidth={2}
        d={edgePath}
      />
      <circle cx={toX} cy={toY} r={3.5} fill="var(--primary)" />
    </g>
  )
}

function WorkflowCanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
  markerEnd,
}: EdgeProps<WorkflowFlowEdge>) {
  const edgeData = data as WorkflowEdgeRenderData | undefined
  const active = selected || edgeData?.active
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sourceX - 8,
    sourceY,
    sourcePosition: Position.Right,
    targetX: targetX + 8,
    targetY,
    targetPosition: Position.Left,
    curvature: 0.16,
  })
  const [insertOpen, setInsertOpen] = useState(false)
  const [insertHovered, setInsertHovered] = useState(false)
  const insertVisible = active || insertOpen || insertHovered

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(
          "transition-all",
          active ? "!stroke-primary" : "!stroke-muted-foreground/45"
        )}
        style={{
          strokeWidth: 2,
        }}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setInsertHovered(true)}
        onMouseLeave={() => setInsertHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute transition-opacity duration-150"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: insertVisible ? "all" : "none",
            opacity: insertVisible ? 1 : 0,
          }}
          onMouseEnter={() => setInsertHovered(true)}
          onMouseLeave={() => setInsertHovered(false)}
        >
          <Popover open={insertOpen} onOpenChange={setInsertOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:scale-150 hover:border-primary hover:text-primary"
                  aria-label="在连线上添加节点"
                >
                  <PlusIcon className="size-3" />
                </button>
              }
            />
            <PopoverContent side="right" align="center" className="w-72 p-2">
              <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">添加节点</div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {(edgeData?.nodeSpecs ?? []).map((spec) => (
                  <button
                    key={spec.type}
                    type="button"
                    className="flex w-full rounded-md px-2 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      edgeData?.onInsertNode?.(id, spec)
                      setInsertOpen(false)
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{spec.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {spec.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

function WorkflowNodeHandle({
  id,
  type,
  position,
  className,
  showIcon = true,
}: {
  id?: string
  type: "source" | "target"
  position: Position
  className?: string
  showIcon?: boolean
}) {
  return (
    <Handle
      id={id}
      type={type}
      position={position}
      className={className}
    >
      {showIcon ? <PlusIcon className="size-2.5" /> : null}
    </Handle>
  )
}

function WorkflowAddAfterButton({
  nodeId,
  visible,
  className,
  nodeSpecs,
  onAddAfter,
}: {
  nodeId: string
  visible: boolean
  className?: string
  nodeSpecs?: AIWorkflowNodeSpec[]
  onAddAfter?: (sourceNodeId: string, spec: AIWorkflowNodeSpec) => void
}) {
  if (!nodeSpecs?.length || !onAddAfter) {
    return null
  }
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "absolute z-20 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-150",
              visible ? "opacity-100" : "pointer-events-none opacity-0",
              className
            )}
            aria-label="添加下游节点"
          >
            <PlusIcon className="size-3" />
          </button>
        }
      />
      <PopoverContent side="right" align="center" className="w-72 p-2">
        <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">添加下游节点</div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {nodeSpecs.map((spec) => (
            <button
              key={spec.type}
              type="button"
              className="flex w-full rounded-md px-2 py-2 text-left hover:bg-muted"
              onClick={() => onAddAfter(nodeId, spec)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{spec.title}</span>
                <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {spec.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function WorkflowNodeTypeIcon({ nodeType }: { nodeType?: string }) {
  const iconClassName = "size-3.5"
  switch (nodeType) {
    case "start":
      return <PlayIcon className={iconClassName} />
    case "condition":
    case "answerability_gate":
      return <GitBranchIcon className={iconClassName} />
    case "knowledge_retrieve":
      return <DatabaseIcon className={iconClassName} />
    case "llm_reply":
      return <BotIcon className={iconClassName} />
    case "send_reply":
      return <MessageSquareTextIcon className={iconClassName} />
    case "handoff_to_human":
      return <UserRoundIcon className={iconClassName} />
    case "end":
      return <CircleStopIcon className={iconClassName} />
    default:
      return <BotIcon className={iconClassName} />
  }
}

function getWorkflowNodeIconClassName(nodeType?: string) {
  switch (nodeType) {
    case "start":
      return "bg-blue-500"
    case "condition":
    case "answerability_gate":
      return "bg-cyan-500"
    case "knowledge_retrieve":
      return "bg-emerald-500"
    case "llm_reply":
      return "bg-indigo-500"
    case "send_reply":
    case "end":
      return "bg-amber-500"
    case "handoff_to_human":
      return "bg-violet-500"
    default:
      return "bg-sky-500"
  }
}

function WorkflowCanvasNode({ id, data, selected }: NodeProps<WorkflowFlowNode>) {
  const [hovered, setHovered] = useState(false)
  const missingInputs = data.missingInputs ?? []
  const hasIssue = missingInputs.length > 0
  const isConditionNode = data.nodeType === "condition"
  const nodeSpecs = data.nodeSpecs as AIWorkflowNodeSpec[] | undefined
  const onAddAfter = data.onAddAfter as
    | ((sourceNodeId: string, spec: AIWorkflowNodeSpec) => void)
    | undefined
  const showHandles = selected || hovered
  const targetHandleClassName = cn(
    "!z-[1] !size-4 !rounded-none !border-none !bg-transparent !outline-none",
    "after:absolute after:left-1.5 after:top-1 after:h-2 after:w-0.5 after:rounded-sm after:bg-muted-foreground/45",
    "transition-all hover:scale-125"
  )
  const sourceHandleClassName = cn(
    "!z-[1] !size-4 !rounded-none !border-none !bg-transparent !outline-none",
    "after:absolute after:right-1.5 after:top-1 after:h-2 after:w-0.5 after:rounded-sm after:bg-muted-foreground/45",
    "transition-all hover:scale-125"
  )
  const conditionBranchHandleClassName = cn(
    "!z-[1] !size-4 !rounded-none !border-none !bg-transparent !outline-none",
    "after:absolute after:right-1.5 after:top-1 after:h-2 after:w-0.5 after:rounded-sm after:bg-muted-foreground/45",
    "transition-all hover:scale-125"
  )
  if (isConditionNode) {
    const branches = data.branchSummaries ?? []
    const caseBranches = branches.filter((branch) => !branch.isDefault)
    const defaultBranch = branches.find((branch) => branch.isDefault)
    return (
      <div
        className={[
          "group/node relative w-[240px] rounded-2xl border bg-background pb-1 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
          selected ? "border-primary ring-4 ring-primary/10" : "",
          hasIssue ? "border-destructive/70" : "border-border/70",
        ].join(" ")}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <WorkflowNodeHandle
          type="target"
          position={Position.Left}
          className={cn("!left-[-9px] !top-4 !translate-y-0", targetHandleClassName)}
          showIcon={false}
        />
        <div className="overflow-hidden rounded-2xl">
          <div className="flex items-center px-3 pb-2 pt-3">
            <div
              className={cn(
                "mr-2 flex size-6 shrink-0 items-center justify-center rounded-lg text-white shadow-md",
                getWorkflowNodeIconClassName(data.nodeType)
              )}
            >
              <WorkflowNodeTypeIcon nodeType={data.nodeType} />
            </div>
            <div className="min-w-0 grow truncate text-sm font-semibold uppercase text-foreground">
              {data.name ?? data.title}
            </div>
          </div>
          <div className="px-3">
            {caseBranches.length > 0 ? caseBranches.map((branch, index) => (
              <div key={branch.branchId}>
                <div className="relative flex h-6 items-center px-1">
                  <div className="flex w-full items-center justify-between">
                    <div className="text-[10px] font-semibold text-muted-foreground/80">
                      {caseBranches.length > 1 ? `CASE ${index + 1}` : ""}
                    </div>
                    <div className="text-[12px] font-semibold text-muted-foreground">
                      {index === 0 ? "IF" : "ELIF"}
                    </div>
                  </div>
                  <WorkflowNodeHandle
                    id={getConditionBranchHandleId(branch.branchId)}
                    type="source"
                    position={Position.Right}
                    className={cn(
                      "!right-[-21px] !top-1/2 !-translate-y-1/2",
                      conditionBranchHandleClassName,
                      branch.targetNodeId && "after:bg-primary/70"
                    )}
                    showIcon={false}
                  />
                </div>
                <div className="space-y-0.5">
                  <div
                    className={cn(
                      "flex h-6 items-center rounded-md bg-muted px-1 text-xs font-normal text-muted-foreground",
                      branch.conditionSet && "text-foreground"
                    )}
                    title={branch.conditionLabel}
                  >
                    <span className="truncate">
                      {branch.conditionSet ? branch.conditionLabel : "条件未配置"}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex h-6 items-center rounded-md bg-muted px-1 text-xs text-muted-foreground">
                条件未配置
              </div>
            )}
            <div className="relative flex h-6 items-center px-1">
              <div className="w-full text-right text-xs font-semibold text-muted-foreground">ELSE</div>
              {defaultBranch ? (
                <WorkflowNodeHandle
                  id={getConditionBranchHandleId(defaultBranch.branchId)}
                  type="source"
                  position={Position.Right}
                  className={cn(
                    "!right-[-21px] !top-1/2 !-translate-y-1/2",
                    conditionBranchHandleClassName,
                    defaultBranch.targetNodeId && "after:bg-primary/70"
                  )}
                  showIcon={false}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div
      className={[
        "group/node relative w-[240px] rounded-2xl border bg-background pb-1 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg",
        selected ? "border-primary ring-4 ring-primary/10" : "",
        hasIssue ? "border-destructive/70" : "border-border/70",
      ].join(" ")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <WorkflowNodeHandle
        type="target"
        position={Position.Left}
        className={cn("!left-[-9px] !top-4 !translate-y-0", targetHandleClassName)}
        showIcon={false}
      />
      <div className="overflow-hidden rounded-2xl">
        <div className="flex items-center px-3 pb-2 pt-3">
          <div
            className={cn(
              "mr-2 flex size-6 shrink-0 items-center justify-center rounded-lg text-white shadow-md",
              getWorkflowNodeIconClassName(data.nodeType)
            )}
          >
            <WorkflowNodeTypeIcon nodeType={data.nodeType} />
          </div>
          <div className="mr-1 flex min-w-0 grow items-center text-sm font-semibold uppercase text-foreground">
            <div className="min-w-0 grow truncate" title={data.name ?? data.title}>
              {data.name ?? data.title}
            </div>
            {hasIssue ? (
              <AlertCircleIcon className="ml-2 size-3.5 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2Icon className="ml-2 size-3.5 shrink-0 text-emerald-600" />
            )}
          </div>
        </div>
        <div className="space-y-1 px-3 text-xs">
          <div className="flex h-6 items-center justify-between rounded-md bg-muted px-1 text-muted-foreground">
            <span className="truncate font-medium uppercase">INPUTS</span>
            <span>{data.inputCount ?? 0}</span>
          </div>
          <div className="flex h-6 items-center justify-between rounded-md bg-muted px-1 text-muted-foreground">
            <span className="truncate font-medium uppercase">OUTPUTS</span>
            <span>{data.outputCount ?? 0}</span>
          </div>
          {hasIssue ? (
            <div className="flex min-h-6 items-center rounded-md bg-destructive/10 px-1 text-destructive">
              缺少输入：{missingInputs.join("、")}
            </div>
          ) : null}
        </div>
      </div>
      <WorkflowNodeHandle
        type="source"
        position={Position.Right}
        className={cn("!right-[-9px] !top-4 !translate-y-0", sourceHandleClassName)}
        showIcon={false}
      />
      <WorkflowAddAfterButton
        nodeId={id}
        visible={showHandles}
        className="right-2 top-2"
        nodeSpecs={nodeSpecs}
        onAddAfter={onAddAfter}
      />
    </div>
  )
}

function WorkflowCanvasToolbar({
  validationErrors,
  validationValid,
  onValidate,
  validateDisabled,
  onSaveDraft,
  saveDraftDisabled,
  onPublish,
  publishDisabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRestoreDefault,
  restoreDefaultDisabled,
  toolbarExtra,
}: {
  validationErrors: string[]
  validationValid: boolean
  onValidate?: () => void
  validateDisabled?: boolean
  onSaveDraft?: () => void
  saveDraftDisabled?: boolean
  onPublish?: () => void
  publishDisabled?: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onRestoreDefault?: () => void
  restoreDefaultDisabled?: boolean
  toolbarExtra?: ReactNode
}) {
  return (
    <div className="flex overflow-hidden rounded-md border bg-background/95 shadow-sm">
      <WorkflowValidationIndicator errors={validationErrors} valid={validationValid} />
      {onValidate ? (
        <>
          <WorkflowToolbarDivider />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-none px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onValidate}
            disabled={validateDisabled}
          >
            <CheckCircle2Icon className="size-3.5" />
            校验
          </Button>
        </>
      ) : null}
      {onSaveDraft ? (
        <>
          <WorkflowToolbarDivider />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-none px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onSaveDraft}
            disabled={saveDraftDisabled}
          >
            <SaveIcon className="size-3.5" />
            保存草稿
          </Button>
        </>
      ) : null}
      {onPublish ? (
        <>
          <WorkflowToolbarDivider />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-none px-2 text-xs font-medium text-foreground hover:text-foreground"
            onClick={onPublish}
            disabled={publishDisabled}
          >
            <SendIcon className="size-3.5" />
            发布流程
          </Button>
        </>
      ) : null}
      {onRestoreDefault ? (
        <>
          <WorkflowToolbarDivider />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-none px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onRestoreDefault}
            disabled={restoreDefaultDisabled}
          >
            <RotateCcwIcon className="size-3.5" />
            恢复默认
          </Button>
        </>
      ) : null}
      {toolbarExtra ? (
        <>
          <WorkflowToolbarDivider />
          {toolbarExtra}
        </>
      ) : null}
      <WorkflowToolbarDivider />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-none text-muted-foreground hover:text-foreground"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="撤销"
        title="撤销"
      >
        <Undo2Icon className="size-3.5" />
      </Button>
      <WorkflowToolbarDivider />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 rounded-none text-muted-foreground hover:text-foreground"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="反撤销"
        title="反撤销"
      >
        <Redo2Icon className="size-3.5" />
      </Button>
    </div>
  )
}

function WorkflowToolbarDivider() {
  return <div className="my-1.5 h-4 w-px shrink-0 self-center bg-border/70" />
}

function WorkflowValidationIndicator({
  errors,
  valid,
}: {
  errors: string[]
  valid: boolean
}) {
  if (valid) {
    return (
      <div className="flex h-7 items-center gap-1.5 px-2 text-xs font-medium text-primary">
        <CheckCircle2Icon className="size-3.5" />
        流程可发布
      </div>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 px-2 text-xs font-medium text-destructive outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <AlertCircleIcon className="size-3.5" />
        {errors.length} 个待处理
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80">
        <div className="text-sm font-medium">Validation issues</div>
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-xs text-destructive">
          {errors.map((error) => (
            <li key={error} className="rounded-md bg-destructive/10 px-2 py-1.5">
              {error}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function WorkflowHelperLines({ lines }: { lines: WorkflowHelperLine }) {
  if (!lines.horizontal && !lines.vertical) {
    return null
  }

  return (
    <ViewportPortal>
      {lines.horizontal ? (
        <div
          className="pointer-events-none absolute z-10 h-px bg-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]"
          style={{
            left: lines.horizontal.left,
            top: lines.horizontal.y,
            width: lines.horizontal.width,
          }}
        />
      ) : null}
      {lines.vertical ? (
        <div
          className="pointer-events-none absolute z-10 w-px bg-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)]"
          style={{
            left: lines.vertical.x,
            top: lines.vertical.top,
            height: lines.vertical.height,
          }}
        />
      ) : null}
    </ViewportPortal>
  )
}
