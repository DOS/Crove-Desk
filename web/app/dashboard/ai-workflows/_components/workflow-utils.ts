import type { AIWorkflowDefinition, AIWorkflowNodeSpec, AIWorkflowValue } from "@/lib/api/admin"

export type WorkflowNodePosition = {
  x: number
  y: number
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

export type WorkflowValue = AIWorkflowValue
export type WorkflowVariableSelector = Extract<AIWorkflowValue, { type: "ref" }>

export type WorkflowCondition = {
  expression?: string
  left?: WorkflowValue
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

export type WorkflowVariableOption = {
  value: string
  label: string
  subtitle: string
  description: string
}

export type WorkflowVariableSpecDisplay = {
  key: string
  label: string
  subtitle: string
  description: string
}

export type WorkflowNodeSpec = AIWorkflowNodeSpec

export type WorkflowDraftValidation = {
  valid: boolean
  errors: string[]
}

export type WorkflowNode = AIWorkflowDefinition["nodes"][number]
export type WorkflowNodeData = WorkflowNode["data"]
export type WorkflowEdge = AIWorkflowDefinition["edges"][number]

export function createRefValue(nodeId: string, field: string): WorkflowVariableSelector {
  return { type: "ref", content: [nodeId, field] }
}

export function isRefValue(value: WorkflowValue | undefined): value is WorkflowVariableSelector {
  return value?.type === "ref" && Array.isArray(value.content) && value.content.length >= 2
}

export function refNodeId(value: WorkflowValue | undefined): string {
  return isRefValue(value) ? value.content[0] : ""
}

export function refField(value: WorkflowValue | undefined): string {
  return isRefValue(value) ? value.content[1] : ""
}

export function buildVariableOption(variable: WorkflowVariableRef): WorkflowVariableOption {
  const ref = `${variable.nodeId}.${variable.field}`
  const label = `${variable.nodeName} / ${variable.label || variable.field}`
  return {
    value: ref,
    label,
    subtitle: [ref, variable.type].filter(Boolean).join(" · "),
    description: variable.description,
  }
}

export function buildVariableSpecDisplay(variable: WorkflowVariableSpec): WorkflowVariableSpecDisplay {
  return {
    key: variable.name,
    label: variable.label || variable.name,
    subtitle: [variable.name, variable.type].filter(Boolean).join(" · "),
    description: variable.description || "",
  }
}

export function isBranchRowActionTarget(target: EventTarget | null): boolean {
  const maybeElement = target as { closest?: (selector: string) => Element | null } | null
  return typeof maybeElement?.closest === "function" && maybeElement.closest("button") !== null
}

export function getNodeTitle(
  node: AIWorkflowDefinition["nodes"][number] | undefined,
  specs: AIWorkflowNodeSpec[] = []
) {
  if (!node) {
    return ""
  }
  return node.data?.title || specs.find((item) => item.type === node.type)?.title || node.type || node.id
}

export function validateWorkflowDefinition(
  definition: AIWorkflowDefinition,
  nodeSpecs: AIWorkflowNodeSpec[] = []
): WorkflowDraftValidation {
  const errors: string[] = []
  const nodes = definition.nodes ?? []
  const edges = definition.edges ?? []
  const startNodes = nodes.filter((node) => node.type === "start")
  const endNodes = nodes.filter((node) => node.type === "end")

  if (startNodes.length !== 1) {
    errors.push("workflow must contain exactly one start node")
  }
  if (endNodes.length === 0) {
    errors.push("workflow must contain at least one end node")
  }

  const nodeIds = new Set<string>()
  for (const node of nodes) {
    if (!node.id?.trim()) {
      errors.push("node id is required")
      continue
    }
    if (nodeIds.has(node.id)) {
      errors.push(`duplicate node id: ${node.id}`)
    }
    nodeIds.add(node.id)
    if (!node.type?.trim()) {
      errors.push(`node type is required: ${node.id}`)
    }
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeID)) {
      errors.push(`edge source node does not exist: ${edge.sourceNodeID}`)
    }
    if (!nodeIds.has(edge.targetNodeID)) {
      errors.push(`edge target node does not exist: ${edge.targetNodeID}`)
    }
  }

  const specByType = new Map(nodeSpecs.map((spec) => [spec.type, spec]))
  for (const node of nodes) {
    const spec = specByType.get(node.type)
    if (!spec) {
      continue
    }
    const inputsValues = node.data?.inputsValues ?? {}
    for (const input of spec.inputSchema ?? []) {
      if (input.required && !inputsValues[input.name]) {
        errors.push(`${getNodeTitle(node, nodeSpecs)} missing required input: ${input.label || input.name}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function createWorkflowNodeFromSpec(
  spec: AIWorkflowNodeSpec,
  existingNodes: Pick<AIWorkflowDefinition["nodes"][number], "id">[],
  position: WorkflowNodePosition
): AIWorkflowDefinition["nodes"][number] {
  const id = uniqueNodeId(existingNodes, spec.type)
  const defaultConfig = spec.type === "condition"
    ? { branches: [{ id: "default", name: "默认分支", targetNodeId: "", default: true }] }
    : {}
  return {
    id,
    type: spec.type,
    meta: { position },
    data: {
      title: spec.title || spec.type,
      config: defaultConfig,
      inputsValues: spec.defaultInputs ?? {},
    },
  }
}

export function updateWorkflowNodeData(
  definition: AIWorkflowDefinition,
  nodeId: string,
  data: WorkflowNodeData
): AIWorkflowDefinition {
  return {
    ...definition,
    nodes: definition.nodes.map((node) => (
      node.id === nodeId ? { ...node, data } : node
    )),
  }
}

export function deleteWorkflowNode(
  definition: AIWorkflowDefinition,
  nodeId: string
): AIWorkflowDefinition {
  const node = definition.nodes.find((item) => item.id === nodeId)
  if (!node || node.type === "start") {
    return definition
  }
  return {
    ...definition,
    nodes: definition.nodes.filter((item) => item.id !== nodeId),
    edges: definition.edges.filter((edge) => (
      edge.sourceNodeID !== nodeId && edge.targetNodeID !== nodeId
    )),
  }
}

export function upsertConditionBranch(
  definition: AIWorkflowDefinition,
  nodeId: string,
  branch: WorkflowConditionBranch
): AIWorkflowDefinition {
  const node = definition.nodes.find((item) => item.id === nodeId)
  if (!node) {
    return definition
  }
  const config = normalizeNodeConfig(node.data?.config)
  const branches = config.branches ?? []
  const nextBranches = branches.some((item) => item.id === branch.id)
    ? branches.map((item) => (item.id === branch.id ? branch : item))
    : [...branches, branch]
  return updateWorkflowNodeData(definition, nodeId, {
    ...(node.data ?? {}),
    config: { ...config, branches: nextBranches },
  })
}

export function deleteConditionBranch(
  definition: AIWorkflowDefinition,
  nodeId: string,
  branchId: string
): AIWorkflowDefinition {
  const node = definition.nodes.find((item) => item.id === nodeId)
  if (!node) {
    return definition
  }
  const config = normalizeNodeConfig(node.data?.config)
  const nextDefinition = updateWorkflowNodeData(definition, nodeId, {
    ...(node.data ?? {}),
    config: {
      ...config,
      branches: (config.branches ?? []).filter((branch) => branch.id !== branchId),
    },
  })
  return {
    ...nextDefinition,
    edges: nextDefinition.edges.filter((edge) => !(edge.sourceNodeID === nodeId && edge.sourcePortID === branchId)),
  }
}

export function normalizeConditionPortsForFlowgram(
  definition: AIWorkflowDefinition
): AIWorkflowDefinition {
  const branchIdsByNodeId = new Map<string, Set<string>>()
  for (const node of definition.nodes) {
    if (node.type !== "condition") {
      continue
    }
    const config = normalizeNodeConfig(node.data?.config)
    const branches = ensureConditionBranches(config.branches ?? [])
    branchIdsByNodeId.set(node.id, new Set(branches.map((branch) => branch.id)))
  }

  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      if (node.type !== "condition") {
        return node
      }
      const config = normalizeNodeConfig(node.data?.config)
      const branches = ensureConditionBranches(config.branches ?? [])
      return {
        ...node,
        data: {
          ...(node.data ?? {}),
          config: { ...config, branches },
          portKeys: branches.map((branch) => branch.id),
          ports: branches.map((branch) => branch.id),
        },
      }
    }),
    edges: definition.edges.filter((edge) => {
      if (!edge.sourcePortID) {
        return true
      }
      const branchIds = branchIdsByNodeId.get(edge.sourceNodeID)
      return !branchIds || branchIds.has(edge.sourcePortID)
    }).map((edge) => {
      const source = definition.nodes.find((node) => node.id === edge.sourceNodeID)
      if (!source || source.type !== "condition" || edge.sourcePortID) {
        return edge
      }
      const branch = findConditionBranchForTarget(source, edge.targetNodeID)
      return branch ? { ...edge, sourcePortID: branch.id } : edge
    }),
  }
}

export function syncConditionBranchTargetsFromEdges(
  definition: AIWorkflowDefinition
): AIWorkflowDefinition {
  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      if (node.type !== "condition") {
        return node
      }
      const config = normalizeNodeConfig(node.data?.config)
      const branches = ensureConditionBranches(config.branches ?? [])
      const nextBranches = branches.map((branch) => {
        const edge = definition.edges.find((item) => (
          item.sourceNodeID === node.id && item.sourcePortID === branch.id
        ))
        return edge ? { ...branch, targetNodeId: edge.targetNodeID } : branch
      })
      return {
        ...node,
        data: {
          ...(node.data ?? {}),
          config: { ...config, branches: nextBranches },
          portKeys: nextBranches.map((branch) => branch.id),
          ports: nextBranches.map((branch) => branch.id),
        },
      }
    }),
  }
}

export function normalizeNodeConfig(config: unknown): WorkflowNodeConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {}
  }
  const record = config as Record<string, unknown>
  const branches = Array.isArray(record.branches)
    ? record.branches
        .map(normalizeConditionBranch)
        .filter((branch): branch is WorkflowConditionBranch => branch !== null)
    : undefined
  return {
    ...record,
    ...(branches ? { branches } : {}),
  } as WorkflowNodeConfig
}

function ensureConditionBranches(branches: WorkflowConditionBranch[]) {
  if (branches.some((branch) => branch.default)) {
    return orderConditionBranches(branches)
  }
  return orderConditionBranches([
    ...branches,
    { id: "default", name: "默认分支", targetNodeId: "", default: true },
  ])
}

function orderConditionBranches(branches: WorkflowConditionBranch[]) {
  return [
    ...branches.filter((branch) => !branch.default),
    ...branches.filter((branch) => branch.default).slice(0, 1),
  ]
}

function findConditionBranchForTarget(
  node: AIWorkflowDefinition["nodes"][number],
  targetNodeId: string
) {
  const branches = ensureConditionBranches(normalizeNodeConfig(node.data?.config).branches ?? [])
  return branches.find((branch) => branch.targetNodeId === targetNodeId)
}

export function createConditionBranchID(existingBranches: WorkflowConditionBranch[]) {
  const existingIDs = new Set(existingBranches.map((branch) => branch.id))
  for (let index = 1; index < 10000; index++) {
    const id = `branch_${index}`
    if (!existingIDs.has(id)) {
      return id
    }
  }
  return `branch_${Date.now()}`
}

export function getAvailableVariables(
  definition: AIWorkflowDefinition,
  nodeId: string,
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowVariableRef[] {
  const ancestorIds = collectAncestorNodeIds(definition, nodeId)
  const specByType = new Map(nodeSpecs.map((spec) => [spec.type, spec]))
  const ret: WorkflowVariableRef[] = []

  for (const id of ancestorIds) {
    const node = definition.nodes.find((item) => item.id === id)
    if (!node) {
      continue
    }
    const spec = specByType.get(node.type)
    for (const output of spec?.outputSchema ?? []) {
      ret.push({
        nodeId: node.id,
        nodeName: getNodeTitle(node, nodeSpecs),
        field: output.name,
        label: output.label,
        type: output.type,
        description: output.description || "",
        operators: output.operators,
        valueOptions: output.valueOptions,
      })
    }
  }

  return ret
}

function collectAncestorNodeIds(definition: AIWorkflowDefinition, nodeId: string): string[] {
  const incoming = new Map<string, string[]>()
  for (const edge of definition.edges ?? []) {
    const list = incoming.get(edge.targetNodeID) ?? []
    list.push(edge.sourceNodeID)
    incoming.set(edge.targetNodeID, list)
  }

  const result: string[] = []
  const seen = new Set<string>()
  const visit = (id: string) => {
    for (const source of incoming.get(id) ?? []) {
      if (seen.has(source)) {
        continue
      }
      seen.add(source)
      visit(source)
      result.push(source)
    }
  }
  visit(nodeId)
  return result
}

function uniqueNodeId(existingNodes: Pick<AIWorkflowDefinition["nodes"][number], "id">[], nodeType: string) {
  const normalizedType = nodeType.replace(/[^a-zA-Z0-9_]/g, "_") || "node"
  const existingIDs = new Set(existingNodes.map((node) => node.id))
  for (let index = 1; index < 10000; index++) {
    const id = `${normalizedType}_${index}`
    if (!existingIDs.has(id)) {
      return id
    }
  }
  return `${normalizedType}_${Date.now()}`
}

function normalizeConditionBranch(value: unknown): WorkflowConditionBranch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id : ""
  const targetNodeId = typeof record.targetNodeId === "string" ? record.targetNodeId : ""
  if (!id) {
    return null
  }
  return {
    id,
    name: typeof record.name === "string" ? record.name : undefined,
    targetNodeId,
    default: record.default === true,
    condition: normalizeCondition(record.condition),
  }
}

function normalizeCondition(value: unknown): WorkflowCondition | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  return {
    expression: typeof record.expression === "string" ? record.expression : undefined,
    left: isWorkflowValue(record.left) ? record.left : undefined,
    operator: typeof record.operator === "string" ? record.operator : undefined,
    right: record.right,
  }
}

function isWorkflowValue(value: unknown): value is WorkflowValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }
  const type = (value as Record<string, unknown>).type
  return type === "ref" || type === "constant" || type === "template"
}
