import { nanoid } from 'nanoid';
import type { IFlowValue } from '@flowgram.ai/form-materials';

import type { FlowDocumentJSON, FlowNodeJSON, FlowNodeRegistry } from '../typings';
import iconVariable from '../assets/icon-variable.png';

export type WorkflowVariableSpec = {
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  description: string;
};

export type WorkflowNodeSpec = {
  type: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  executable: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  interruptible: boolean;
  requiresConfirmationPredecessor: boolean;
  inputSchema?: WorkflowVariableSpec[];
  outputSchema?: WorkflowVariableSpec[];
  defaultInputs?: Record<string, IFlowValue>;
};

const builtInNodeTypes = new Set(['start', 'end', 'llm', 'condition']);

function schemaType(type: string): string {
  switch (type) {
    case 'integer':
      return 'number';
    case 'array<string>':
    case 'array<int>':
    case 'array<object>':
      return 'array';
    default:
      return type;
  }
}

function buildSchema(variables: WorkflowVariableSpec[] | undefined) {
  const properties = Object.fromEntries(
    (variables ?? []).map((variable) => [
      variable.name,
      {
        type: schemaType(variable.type),
        title: variable.label || variable.name,
        description: variable.description,
        extra: variable.type === 'string' ? { formComponent: 'prompt-editor' } : undefined,
      },
    ])
  );
  return {
    type: 'object' as const,
    required: (variables ?? []).filter((item) => item.required).map((item) => item.name),
    properties,
  };
}

export function createBusinessNodeRegistries(specs: WorkflowNodeSpec[]): FlowNodeRegistry[] {
  return specs
    .filter((spec) => spec.executable && !builtInNodeTypes.has(spec.type))
    .map((spec) => ({
      type: spec.type,
      info: { icon: iconVariable, title: spec.title, description: spec.description },
      meta: {
        defaultPorts: [{ type: 'input' }, { type: 'output' }],
        size: { width: 360, height: 280 },
      },
      onAdd() {
        return {
          id: `${spec.type}_${nanoid(5)}`,
          type: spec.type,
          data: {
            title: spec.title,
            inputsValues: structuredClone(spec.defaultInputs ?? {}),
            inputs: buildSchema(spec.inputSchema),
            outputs: buildSchema(spec.outputSchema),
            nodeSpec: {
              category: spec.category,
              riskLevel: spec.riskLevel,
              interruptible: spec.interruptible,
              requiresConfirmationPredecessor: spec.requiresConfirmationPredecessor,
            },
          },
        } as FlowNodeJSON;
      },
    }));
}

export function enrichDocumentWithNodeSpecs(
  document: FlowDocumentJSON,
  specs: WorkflowNodeSpec[]
): FlowDocumentJSON {
  const specsByType = new Map(specs.map((spec) => [spec.type, spec]));
  const conditionNodeIDs = new Set(
    document.nodes
      .filter((node) => node.type === 'condition' && Array.isArray(node.data.config?.branches))
      .map((node) => node.id)
  );
  return {
    ...document,
    edges: document.edges.map((edge) =>
      conditionNodeIDs.has(edge.sourceNodeID) && edge.sourcePortID === 'default'
        ? { ...edge, sourcePortID: 'else' }
        : edge
    ),
    nodes: document.nodes.map((node) => {
      const spec = specsByType.get(node.type as string);
      if (!spec) return node;
      const legacyBranches = Array.isArray(node.data.config?.branches)
        ? node.data.config.branches
        : [];
      const conditions = legacyBranches
        .filter((branch: any) => !branch.default && branch.condition)
        .map((branch: any) => ({
          key: branch.id,
          value: {
            left: branch.condition.left,
            operator: branch.condition.operator,
            right: { type: 'constant', content: branch.condition.right },
          },
        }));
      return {
        ...node,
        data: {
          ...node.data,
          title: node.data.title || spec.title,
          inputsValues: node.data.inputsValues ?? structuredClone(spec.defaultInputs ?? {}),
          inputs: node.data.inputs ?? buildSchema(spec.inputSchema),
          outputs: node.data.outputs ?? buildSchema(spec.outputSchema),
          nodeSpec: {
            category: spec.category,
            riskLevel: spec.riskLevel,
            interruptible: spec.interruptible,
            requiresConfirmationPredecessor: spec.requiresConfirmationPredecessor,
          },
          ...(node.type === 'condition' && conditions.length > 0 ? { conditions } : {}),
        },
      };
    }),
  };
}
