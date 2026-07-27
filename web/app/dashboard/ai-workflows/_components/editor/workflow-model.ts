import type {
  AIWorkflowDefinition,
  AIWorkflowNodeSpec,
  AIWorkflowValue,
} from "@/lib/api/admin"
import type { WorkflowNodeJSON } from "@flowgram.ai/free-layout-editor"

import type {
  WorkflowConditionBranch,
  WorkflowNode,
  WorkflowVariable,
} from "./types"

const defaultBranch: WorkflowConditionBranch = {
  id: "default",
  name: "默认分支",
  targetNodeId: "",
  default: true,
}

export function prepareDefinitionForEditor(
  definition: AIWorkflowDefinition
): AIWorkflowDefinition {
  const branchIDsByNode = new Map<string, Set<string>>()
  const executableNodes = (definition.nodes ?? []).map((node) => {
    if (node.type !== "condition") {
      return node
    }
    const branches = normalizeConditionBranches(node)
    branchIDsByNode.set(node.id, new Set(branches.map((branch) => branch.id)))
    return {
      ...node,
      data: {
        ...node.data,
        config: {
          ...asRecord(node.data?.config),
          branches,
        },
        portKeys: branches.map((branch) => branch.id),
        ports: branches.map((branch) => branch.id),
      },
    }
  })
  const nodes = normalizeEditorPositions([
    ...executableNodes,
    ...(definition.annotations ?? []),
  ])

  return {
    schemaVersion: definition.schemaVersion || 2,
    nodes,
    annotations: undefined,
    edges: (definition.edges ?? [])
      .filter((edge) => {
        if (!edge.sourcePortID) return true
        const branchIDs = branchIDsByNode.get(edge.sourceNodeID)
        return !branchIDs || branchIDs.has(edge.sourcePortID)
      })
      .map((edge) => {
        if (edge.sourcePortID) return edge
        const source = nodes.find((node) => node.id === edge.sourceNodeID)
        if (source?.type !== "condition") return edge
        const branch = normalizeConditionBranches(source).find(
          (item) => item.targetNodeId === edge.targetNodeID
        )
        return branch ? { ...edge, sourcePortID: branch.id } : edge
      }),
  }
}

export function serializeDefinition(
  definition: AIWorkflowDefinition
): AIWorkflowDefinition {
  const edges = definition.edges ?? []
  const annotations = (definition.nodes ?? []).filter(
    (node) => node.type === "comment"
  )
  return {
    schemaVersion: definition.schemaVersion || 2,
    nodes: (definition.nodes ?? []).filter((node) => node.type !== "comment").map((node) => {
      const data = { ...node.data }
      delete data.portKeys
      delete data.ports
      if (node.type === "condition") {
        const branches = normalizeConditionBranches(node).map((branch) => {
          const edge = edges.find(
            (item) =>
              item.sourceNodeID === node.id &&
              item.sourcePortID === branch.id
          )
          return {
            ...branch,
            targetNodeId: edge?.targetNodeID ?? branch.targetNodeId ?? "",
          }
        })
        data.config = { ...asRecord(data.config), branches }
      }
      return { ...node, data }
    }),
    annotations,
    edges,
  }
}

export function createNodeJSON(
  spec: AIWorkflowNodeSpec,
  existingNodeIDs: string[] = []
): WorkflowNodeJSON {
  const id = uniqueNodeID(spec.type, existingNodeIDs)
  const config =
    spec.type === "condition" ? { branches: [defaultBranch] } : {}
  return {
    id,
    type: spec.type,
    data: {
      title: spec.title || spec.type,
      config,
      inputsValues: spec.defaultInputs ?? {},
      ...(spec.type === "condition"
        ? { portKeys: [defaultBranch.id], ports: [defaultBranch.id] }
        : {}),
    },
  }
}

export function normalizeConditionBranches(
  node: Pick<WorkflowNode, "data">
): WorkflowConditionBranch[] {
  const config = asRecord(node.data?.config)
  const values = Array.isArray(config.branches) ? config.branches : []
  const branches = values
    .map(normalizeBranch)
    .filter((item): item is WorkflowConditionBranch => Boolean(item))
  const nonDefault = branches.filter((branch) => !branch.default)
  const fallback =
    branches.find((branch) => branch.default) ?? defaultBranch
  return [...nonDefault, fallback]
}

export function nextBranchID(branches: WorkflowConditionBranch[]) {
  const used = new Set(branches.map((branch) => branch.id))
  for (let index = 1; index < 10000; index += 1) {
    const id = `branch_${index}`
    if (!used.has(id)) return id
  }
  return `branch_${Date.now()}`
}

export function buildAvailableVariables(
  definition: AIWorkflowDefinition,
  nodeID: string,
  specs: AIWorkflowNodeSpec[]
): WorkflowVariable[] {
  const ancestors = collectAncestorIDs(definition, nodeID)
  const specByType = new Map(specs.map((spec) => [spec.type, spec]))
  return ancestors.flatMap((ancestorID) => {
    const node = definition.nodes.find((item) => item.id === ancestorID)
    if (!node) return []
    const spec = specByType.get(node.type)
    return (spec?.outputSchema ?? []).map((output) => ({
      ...output,
      nodeId: node.id,
      nodeTitle: String(node.data?.title || spec?.title || node.type),
    }))
  })
}

export function refValue(nodeID: string, field: string): AIWorkflowValue {
  return { type: "ref", content: [nodeID, field] }
}

export function refKey(value: AIWorkflowValue | undefined) {
  if (value?.type !== "ref" || !Array.isArray(value.content)) return ""
  return `${value.content[0]}.${value.content[1]}`
}

export function parseRefKey(value: string): AIWorkflowValue | undefined {
  const separator = value.indexOf(".")
  if (separator <= 0 || separator === value.length - 1) return undefined
  return refValue(value.slice(0, separator), value.slice(separator + 1))
}

function uniqueNodeID(type: string, existingNodeIDs: string[]) {
  const normalized = type.replace(/[^a-zA-Z0-9_]/g, "_") || "node"
  const used = new Set(existingNodeIDs)
  for (let index = 1; index < 10000; index += 1) {
    const id = `${normalized}_${index}`
    if (!used.has(id)) return id
  }
  return `${normalized}_${Date.now()}`
}

function normalizeEditorPositions(
  nodes: AIWorkflowDefinition["nodes"]
): AIWorkflowDefinition["nodes"] {
  const executableXs = Array.from(
    new Set(
      nodes
        .filter((node) => node.type !== "comment")
        .map((node) => node.meta.position.x)
    )
  ).sort((left, right) => left - right)
  const positiveGaps = executableXs
    .slice(1)
    .map((x, index) => x - executableXs[index])
    .filter((gap) => gap > 0)
  const minimumGap = positiveGaps.length ? Math.min(...positiveGaps) : 0
  if (!minimumGap || minimumGap >= 460) return nodes

  const origin = executableXs[0]
  const scale = 460 / minimumGap
  return nodes.map((node) =>
    node.type === "comment"
      ? node
      : {
          ...node,
          meta: {
            ...node.meta,
            position: {
              ...node.meta.position,
              x: origin + (node.meta.position.x - origin) * scale,
            },
          },
        }
  )
}

function normalizeBranch(value: unknown): WorkflowConditionBranch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const id = String(item.id ?? "").trim()
  if (!id) return null
  return {
    id,
    name: String(item.name ?? "").trim(),
    targetNodeId: String(item.targetNodeId ?? "").trim(),
    default: Boolean(item.default),
    condition:
      item.condition && typeof item.condition === "object"
        ? (item.condition as WorkflowConditionBranch["condition"])
        : undefined,
  }
}

function collectAncestorIDs(
  definition: AIWorkflowDefinition,
  nodeID: string
) {
  const incoming = new Map<string, string[]>()
  for (const edge of definition.edges ?? []) {
    incoming.set(edge.targetNodeID, [
      ...(incoming.get(edge.targetNodeID) ?? []),
      edge.sourceNodeID,
    ])
  }
  const queue = [...(incoming.get(nodeID) ?? [])]
  const visited = new Set<string>()
  while (queue.length) {
    const current = queue.shift()
    if (!current || visited.has(current)) continue
    visited.add(current)
    queue.push(...(incoming.get(current) ?? []))
  }
  return definition.nodes
    .map((node) => node.id)
    .filter((id) => visited.has(id))
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
