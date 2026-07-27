import type {
  AIWorkflowDefinition,
  AIWorkflowNodeSpec,
  AIWorkflowValue,
  AIWorkflowVariableSpec,
} from "@/lib/api/admin"

export type WorkflowNode = AIWorkflowDefinition["nodes"][number]
export type WorkflowEdge = AIWorkflowDefinition["edges"][number]

export type WorkflowCondition = {
  left?: AIWorkflowValue
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

export type WorkflowVariable = AIWorkflowVariableSpec & {
  nodeId: string
  nodeTitle: string
}

export type WorkflowEditorContextValue = {
  nodeSpecs: AIWorkflowNodeSpec[]
  readonly: boolean
}

