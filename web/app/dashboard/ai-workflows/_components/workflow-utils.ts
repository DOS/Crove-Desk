export type WorkflowNodePosition = {
  x: number
  y: number
}

export type WorkflowHelperLineNode = {
  id: string
  position: WorkflowNodePosition
  width?: number | null
  height?: number | null
  measured?: {
    width?: number | null
    height?: number | null
  }
}

export type WorkflowHelperLine = {
  horizontal?: {
    y: number
    left: number
    width: number
  }
  vertical?: {
    x: number
    top: number
    height: number
  }
}

export type WorkflowHelperLineResult = WorkflowHelperLine & {
  position: WorkflowNodePosition
}

export type WorkflowEditorNode = {
  id: string
  type?: string
  position: WorkflowNodePosition
  data?: {
    nodeType?: string
    name?: string
    label?: string
    config?: WorkflowNodeConfig
    inputs?: Record<string, WorkflowVariableSelector>
  }
}

export type WorkflowEditorEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export type WorkflowCondition = {
  expression?: string
  left?: WorkflowVariableSelector
  operator?: string
  right?: unknown
}

export type WorkflowConditionBranch = {
  id: string
  name?: string
  targetNodeId: string
  condition?: WorkflowCondition
  default?: boolean
}

export type WorkflowNodeConfig = Record<string, unknown> & {
  branches?: WorkflowConditionBranch[]
}

export type WorkflowDraft = {
  nodes: WorkflowEditorNode[]
  edges: WorkflowEditorEdge[]
}

export type WorkflowDefinition = {
  schemaVersion: number
  entryNodeId: string
  nodes: {
    id: string
    type: string
    name: string
    position: WorkflowNodePosition
    config: WorkflowNodeConfig
    inputs?: Record<string, WorkflowVariableSelector>
  }[]
  edges: {
    id: string
    source: string
    target: string
  }[]
}

export type WorkflowVariableType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array<string>"
  | "array<int>"
  | "array<object>"
  | "any"

export type WorkflowVariableSelector = {
  nodeId: string
  field: string
}

export type WorkflowVariableValueOption = {
  value: unknown
  label: string
  description?: string
}

export type WorkflowVariableSpec = {
  name: string
  label?: string
  type: WorkflowVariableType
  required?: boolean
  description?: string
  operators?: string[]
  valueOptions?: WorkflowVariableValueOption[]
}

export type WorkflowNodeSpec = {
  type: string
  title?: string
  description?: string
  inputSchema?: WorkflowVariableSpec[]
  outputSchema?: WorkflowVariableSpec[]
  defaultInputs?: Record<string, WorkflowVariableSelector>
}

export type WorkflowVariableRef = {
  nodeId: string
  nodeName: string
  field: string
  label?: string
  type: string
  description: string
  operators?: string[]
  valueOptions?: WorkflowVariableValueOption[]
}

export type WorkflowDraftValidation = {
  valid: boolean
  errors: string[]
}

export type WorkflowHistory<T> = {
  past: T[]
  future: T[]
  limit: number
}

export type WorkflowHistoryChange<T> = {
  history: WorkflowHistory<T>
  snapshot: T
}

const helperLineAlignmentThreshold = 6
const defaultWorkflowHistoryLimit = 50
const conditionBranchHandlePrefix = "condition-branch:"

export function getConditionBranchHandleId(branchId: string): string {
  return `${conditionBranchHandlePrefix}${branchId}`
}

export function parseConditionBranchHandleId(handleId?: string | null): string | null {
  if (!handleId?.startsWith(conditionBranchHandlePrefix)) {
    return null
  }
  const branchId = handleId.slice(conditionBranchHandlePrefix.length)
  return branchId || null
}

function cloneHistorySnapshot<T>(snapshot: T): T {
  return JSON.parse(JSON.stringify(snapshot)) as T
}

export function createWorkflowHistory<T>(limit = defaultWorkflowHistoryLimit): WorkflowHistory<T> {
  return {
    past: [],
    future: [],
    limit,
  }
}

export function pushWorkflowHistory<T>(
  history: WorkflowHistory<T>,
  snapshot: T
): WorkflowHistory<T> {
  const past = [...history.past, cloneHistorySnapshot(snapshot)]
  return {
    past: past.slice(Math.max(0, past.length - history.limit)),
    future: [],
    limit: history.limit,
  }
}

export function undoWorkflowHistory<T>(
  history: WorkflowHistory<T>,
  current: T
): WorkflowHistoryChange<T> | null {
  const snapshot = history.past.at(-1)
  if (!snapshot) {
    return null
  }
  return {
    snapshot: cloneHistorySnapshot(snapshot),
    history: {
      past: history.past.slice(0, -1),
      future: [cloneHistorySnapshot(current), ...history.future],
      limit: history.limit,
    },
  }
}

export function redoWorkflowHistory<T>(
  history: WorkflowHistory<T>,
  current: T
): WorkflowHistoryChange<T> | null {
  const snapshot = history.future[0]
  if (!snapshot) {
    return null
  }
  const past = [...history.past, cloneHistorySnapshot(current)]
  return {
    snapshot: cloneHistorySnapshot(snapshot),
    history: {
      past: past.slice(Math.max(0, past.length - history.limit)),
      future: history.future.slice(1),
      limit: history.limit,
    },
  }
}

function getNodeSize(node: WorkflowHelperLineNode) {
  return {
    width: node.measured?.width ?? node.width ?? 0,
    height: node.measured?.height ?? node.height ?? 0,
  }
}

function getNodeAnchorValues(node: WorkflowHelperLineNode) {
  const size = getNodeSize(node)
  return {
    x: [
      node.position.x,
      node.position.x + size.width / 2,
      node.position.x + size.width,
    ],
    y: [
      node.position.y,
      node.position.y + size.height / 2,
      node.position.y + size.height,
    ],
  }
}

function getNearestAlignment(
  axis: "x" | "y",
  nodes: WorkflowHelperLineNode[],
  draggingNode: WorkflowHelperLineNode
) {
  const draggingAnchors = getNodeAnchorValues(draggingNode)[axis]
  let nearest:
    | {
        diff: number
        targetValue: number
        candidate: WorkflowHelperLineNode
      }
    | undefined

  for (const candidate of nodes) {
    if (candidate.id === draggingNode.id) {
      continue
    }
    const candidateAnchors = getNodeAnchorValues(candidate)[axis]
    for (const draggingAnchor of draggingAnchors) {
      for (const candidateAnchor of candidateAnchors) {
        const diff = candidateAnchor - draggingAnchor
        if (Math.abs(diff) > helperLineAlignmentThreshold) {
          continue
        }
        if (!nearest || Math.abs(diff) < Math.abs(nearest.diff)) {
          nearest = {
            diff,
            targetValue: candidateAnchor,
            candidate,
          }
        }
      }
    }
  }

  return nearest
}

export function calculateWorkflowHelperLines(
  nodes: WorkflowHelperLineNode[],
  draggingNode: WorkflowHelperLineNode
): WorkflowHelperLineResult {
  const xAlignment = getNearestAlignment("x", nodes, draggingNode)
  const yAlignment = getNearestAlignment("y", nodes, draggingNode)
  const position = {
    x: draggingNode.position.x + (xAlignment?.diff ?? 0),
    y: draggingNode.position.y + (yAlignment?.diff ?? 0),
  }
  const draggingSize = getNodeSize(draggingNode)
  const snappedDraggingNode = {
    ...draggingNode,
    position,
  }
  const result: WorkflowHelperLineResult = {
    position,
  }

  if (yAlignment) {
    const candidateSize = getNodeSize(yAlignment.candidate)
    const left = Math.min(snappedDraggingNode.position.x, yAlignment.candidate.position.x)
    const right = Math.max(
      snappedDraggingNode.position.x + draggingSize.width,
      yAlignment.candidate.position.x + candidateSize.width
    )
    result.horizontal = {
      y: yAlignment.targetValue,
      left,
      width: right - left,
    }
  }

  if (xAlignment) {
    const candidateSize = getNodeSize(xAlignment.candidate)
    const top = Math.min(snappedDraggingNode.position.y, xAlignment.candidate.position.y)
    const bottom = Math.max(
      snappedDraggingNode.position.y + draggingSize.height,
      xAlignment.candidate.position.y + candidateSize.height
    )
    result.vertical = {
      x: xAlignment.targetValue,
      top,
      height: bottom - top,
    }
  }

  return result
}

export function validateWorkflowDraft(
  draft: WorkflowDraft,
  nodeSpecs: WorkflowNodeSpec[] = []
): WorkflowDraftValidation {
  const errors: string[] = []
  const nodeIds = new Set<string>()
  let startCount = 0
  let endCount = 0

  for (const node of draft.nodes) {
    const id = node.id.trim()
    if (!id) {
      errors.push("node id is required")
      continue
    }
    if (nodeIds.has(id)) {
      errors.push(`duplicate node id: ${id}`)
    }
    nodeIds.add(id)
    const nodeType = node.data?.nodeType ?? node.type
    if (nodeType === "start") {
      startCount += 1
    }
    if (nodeType === "end") {
      endCount += 1
    }
  }

  if (startCount !== 1) {
    errors.push("workflow must contain exactly one start node")
  }
  if (endCount < 1) {
    errors.push("workflow must contain at least one end node")
  }

  const edgeIds = new Set<string>()
  const outgoingTargets = new Map<string, Set<string>>()
  const branchEdges = new Set<string>()
  for (const edge of draft.edges) {
    const id = edge.id.trim()
    if (!id) {
      errors.push("edge id is required")
    } else if (edgeIds.has(id)) {
      errors.push(`duplicate edge id: ${id}`)
    }
    edgeIds.add(id)
    if (!nodeIds.has(edge.source)) {
      errors.push(`edge source node does not exist: ${edge.source}`)
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`edge target node does not exist: ${edge.target}`)
    }
    if (!outgoingTargets.has(edge.source)) {
      outgoingTargets.set(edge.source, new Set())
    }
    outgoingTargets.get(edge.source)?.add(edge.target)
    const branchId = parseConditionBranchHandleId(edge.sourceHandle)
    if (branchId) {
      branchEdges.add(`${edge.source}:${branchId}:${edge.target}`)
    }
  }

  for (const node of draft.nodes) {
    const nodeType = node.data?.nodeType ?? node.type ?? ""
    const spec = getNodeSpec(nodeSpecs, nodeType)
    if (spec) {
      for (const input of getRequiredInputs(spec)) {
        const selector = node.data?.inputs?.[input.name]
        if (!selector?.nodeId || !selector.field) {
          const nodeName = node.data?.name ?? spec.title ?? node.id
          errors.push(`${nodeName} 缺少必填输入「${input.name}」，请选择上游节点的输出变量。`)
        }
      }
    }
    if (nodeType === "condition") {
      const branches = node.data?.config?.branches ?? []
      if (branches.length === 0) {
        errors.push(`${node.data?.name ?? node.id} 至少需要一个分支。`)
        continue
      }
      let defaultCount = 0
      const branchIds = new Set<string>()
      const targets = outgoingTargets.get(node.id) ?? new Set<string>()
      for (const branch of branches) {
        const branchName = branch.name || branch.id || "未命名分支"
        if (!branch.id) {
          errors.push(`${node.data?.name ?? node.id} 存在未填写 ID 的分支。`)
        } else if (branchIds.has(branch.id)) {
          errors.push(`${node.data?.name ?? node.id} 存在重复分支 ID「${branch.id}」。`)
        }
        branchIds.add(branch.id)
        if (!branch.targetNodeId) {
          errors.push(`${node.data?.name ?? node.id} 的分支「${branchName}」缺少目标节点。`)
        } else if (!nodeIds.has(branch.targetNodeId)) {
          errors.push(`${node.data?.name ?? node.id} 的分支「${branchName}」目标节点不存在。`)
        } else if (!targets.has(branch.targetNodeId)) {
          errors.push(`${node.data?.name ?? node.id} 的分支「${branchName}」需要连接到目标节点。`)
        } else if (branchEdges.size > 0 && !branchEdges.has(`${node.id}:${branch.id}:${branch.targetNodeId}`)) {
          errors.push(`${node.data?.name ?? node.id} 的分支「${branchName}」需要从对应分支连接点连到目标节点。`)
        }
        if (branch.default) {
          defaultCount += 1
          if (branch.condition) {
            errors.push(`${node.data?.name ?? node.id} 的默认分支不能配置条件。`)
          }
          if (branches.indexOf(branch) !== branches.length - 1) {
            errors.push(`${node.data?.name ?? node.id} 的默认分支必须放在最后。`)
          }
          continue
        }
        if (!branch.condition?.left?.nodeId || !branch.condition.left.field) {
          errors.push(`${node.data?.name ?? node.id} 的分支「${branchName}」缺少判断变量。`)
        }
        if (!branch.condition?.operator) {
          errors.push(`${node.data?.name ?? node.id} 的分支「${branchName}」缺少判断方式。`)
        }
      }
      if (defaultCount !== 1) {
        errors.push(`${node.data?.name ?? node.id} 必须且只能有一个默认分支。`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function toApiDefinition(draft: WorkflowDraft): WorkflowDefinition {
  const startNode = draft.nodes.find((node) => (node.data?.nodeType ?? node.type) === "start")
  return {
    schemaVersion: 1,
    entryNodeId: startNode?.id ?? "",
    nodes: draft.nodes.map((node) => ({
      id: node.id,
      type: node.data?.nodeType ?? node.type ?? "",
      name: node.data?.name ?? node.type ?? node.id,
      position: {
        x: node.position.x,
        y: node.position.y,
      },
      config: node.data?.config ?? {},
      ...(node.data?.inputs ? { inputs: node.data.inputs } : {}),
    })),
    edges: draft.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  }
}

export function applyConditionBranchConnection(
  draft: WorkflowDraft,
  connection: Pick<WorkflowEditorEdge, "source" | "target" | "sourceHandle">
): WorkflowDraft {
  const branchId = parseConditionBranchHandleId(connection.sourceHandle)
  if (!branchId || !connection.source || !connection.target) {
    return draft
  }
  return updateConditionBranchTarget(draft, connection.source, branchId, connection.target)
}

export function clearConditionBranchConnection(
  draft: WorkflowDraft,
  edge: WorkflowEditorEdge
): WorkflowDraft {
  const branchId = parseConditionBranchHandleId(edge.sourceHandle)
  if (branchId) {
    return updateConditionBranchTarget(draft, edge.source, branchId, "")
  }
  const sourceNode = draft.nodes.find((node) => node.id === edge.source)
  if (!sourceNode || (sourceNode.data?.nodeType ?? sourceNode.type) !== "condition") {
    return draft
  }
  const branch = sourceNode.data?.config?.branches?.find((item) => item.targetNodeId === edge.target)
  return branch ? updateConditionBranchTarget(draft, edge.source, branch.id, "") : draft
}

function updateConditionBranchTarget(
  draft: WorkflowDraft,
  conditionNodeId: string,
  branchId: string,
  targetNodeId: string
): WorkflowDraft {
  let changed = false
  const nodes = draft.nodes.map((node) => {
    if (node.id !== conditionNodeId || (node.data?.nodeType ?? node.type) !== "condition") {
      return node
    }
    const branches = node.data?.config?.branches ?? []
    const nextBranches = branches.map((branch) => {
      if (branch.id !== branchId || branch.targetNodeId === targetNodeId) {
        return branch
      }
      changed = true
      return { ...branch, targetNodeId }
    })
    if (!changed) {
      return node
    }
    return {
      ...node,
      data: {
        ...node.data,
        config: {
          ...(node.data?.config ?? {}),
          branches: nextBranches,
        },
      },
    }
  })
  return changed ? { ...draft, nodes } : draft
}

export function fromApiDefinition(definition: WorkflowDefinition): WorkflowDraft {
  return {
    nodes: (definition.nodes ?? []).map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position ?? { x: 0, y: 0 },
      data: {
        nodeType: node.type,
        name: node.name,
        config: node.config ?? {},
        inputs: node.inputs ?? {},
      },
    })),
    edges: (definition.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  }
}

export function applyAutoInputMappings(
  draft: WorkflowDraft,
  sourceNodeId: string,
  targetNodeId: string,
  nodeSpecs: WorkflowNodeSpec[]
): WorkflowDraft {
  const sourceNode = draft.nodes.find((node) => node.id === sourceNodeId)
  const targetNode = draft.nodes.find((node) => node.id === targetNodeId)
  if (!sourceNode || !targetNode) {
    return draft
  }
  const sourceSpec = getNodeSpec(nodeSpecs, sourceNode.data?.nodeType ?? sourceNode.type ?? "")
  const targetSpec = getNodeSpec(nodeSpecs, targetNode.data?.nodeType ?? targetNode.type ?? "")
  if (!sourceSpec || !targetSpec) {
    return draft
  }
  const nextInputs = { ...(targetNode.data?.inputs ?? {}) }
  let changed = false

  for (const input of targetSpec.inputSchema ?? []) {
    if (nextInputs[input.name]) {
      continue
    }
    const output = findPreferredOutput(input.name, input.type, sourceSpec.outputSchema ?? [])
    if (!output) {
      continue
    }
    nextInputs[input.name] = { nodeId: sourceNodeId, field: output.name }
    changed = true
  }

  if (!changed) {
    return draft
  }

  return {
    ...draft,
    nodes: draft.nodes.map((node) =>
      node.id === targetNodeId
        ? {
            ...node,
            data: {
              ...node.data,
              inputs: nextInputs,
            },
          }
        : node
    ),
  }
}

export function createWorkflowNodeFromSpec(
  spec: WorkflowNodeSpec,
  existingNodes: Pick<WorkflowEditorNode, "id">[],
  position: WorkflowNodePosition
): WorkflowEditorNode {
  const id = uniqueNodeId(existingNodes, spec.type)
  return {
    id,
    type: "workflowNode",
    position,
    data: {
      nodeType: spec.type,
      name: spec.title ?? spec.type,
      label: spec.title ?? spec.type,
      config: {},
      inputs: spec.defaultInputs ?? {},
    },
  }
}

function uniqueNodeId(existingNodes: Pick<WorkflowEditorNode, "id">[], nodeType: string) {
  let nextIndex = existingNodes.length + 1
  let id = `${nodeType}_${nextIndex}`
  while (existingNodes.some((node) => node.id === id)) {
    nextIndex += 1
    id = `${nodeType}_${nextIndex}`
  }
  return id
}

function findPreferredOutput(
  inputName: string,
  inputType: WorkflowVariableType,
  outputs: WorkflowVariableSpec[]
): WorkflowVariableSpec | undefined {
  const preferred = preferredOutputName(inputName)
  if (preferred) {
    const exact = outputs.find((output) => output.name === preferred && variableTypesCompatible(inputType, output.type))
    if (exact) {
      return exact
    }
  }
  const sameName = outputs.find((output) => output.name === inputName && variableTypesCompatible(inputType, output.type))
  if (sameName) {
    return sameName
  }
  return outputs.find((output) => variableTypesCompatible(inputType, output.type))
}

function preferredOutputName(inputName: string): string {
  switch (inputName) {
    case "query":
    case "userMessage":
    case "issue":
    case "prompt":
      return "userMessage"
    case "knowledgeItems":
      return "items"
    case "replyText":
      return "replyText"
    case "confirmed":
      return "confirmed"
    case "ticketDraft":
      return "ticketDraft"
    case "reason":
      return "reason"
    default:
      return ""
  }
}

function variableTypesCompatible(input: WorkflowVariableType, output: WorkflowVariableType): boolean {
  return input === "any" || output === "any" || input === output
}

export function getNodeSpec(
  nodeSpecs: WorkflowNodeSpec[],
  nodeType: string
): WorkflowNodeSpec | undefined {
  return nodeSpecs.find((spec) => spec.type === nodeType)
}

export function getRequiredInputs(spec: WorkflowNodeSpec | undefined): WorkflowVariableSpec[] {
  return (spec?.inputSchema ?? []).filter((item) => item.required)
}

export function getAvailableVariables(
  draft: WorkflowDraft,
  nodeId: string,
  nodeSpecs: WorkflowNodeSpec[]
): WorkflowVariableRef[] {
  const ancestors = collectAncestorNodeIds(draft, nodeId)
  const nodesById = new Map(draft.nodes.map((node) => [node.id, node]))
  const variables: WorkflowVariableRef[] = []

  for (const sourceNodeId of ancestors) {
    const sourceNode = nodesById.get(sourceNodeId)
    if (!sourceNode) {
      continue
    }
    const nodeType = sourceNode.data?.nodeType ?? sourceNode.type ?? ""
    const spec = getNodeSpec(nodeSpecs, nodeType)
    for (const output of spec?.outputSchema ?? []) {
      variables.push({
        nodeId: sourceNode.id,
        nodeName: sourceNode.data?.name ?? spec?.title ?? sourceNode.id,
        field: output.name,
        label: output.label,
        type: output.type,
        description: output.description ?? "",
        operators: output.operators,
        valueOptions: output.valueOptions,
      })
    }
  }

  return variables
}

function collectAncestorNodeIds(draft: WorkflowDraft, nodeId: string): string[] {
  const incoming = new Map<string, string[]>()
  for (const edge of draft.edges) {
    const sources = incoming.get(edge.target) ?? []
    sources.push(edge.source)
    incoming.set(edge.target, sources)
  }

  const visited = new Set<string>()
  const ordered: string[] = []

  function visit(current: string) {
    for (const source of incoming.get(current) ?? []) {
      if (visited.has(source)) {
        continue
      }
      visited.add(source)
      visit(source)
      ordered.push(source)
    }
  }

  visit(nodeId)
  return ordered
}
