import {
  WorkflowStatus,
  type IReport,
  type TaskRunInput,
  type WorkflowInputs,
  type WorkflowOutputs,
} from '@flowgram.ai/runtime-interface';

type DebugNode = {
  id: string;
  type: string;
  data?: {
    config?: Record<string, unknown>;
    inputsValues?: Record<string, DebugValue>;
  };
};

type DebugEdge = {
  sourceNodeID: string;
  targetNodeID: string;
};

type DebugSchema = {
  nodes?: DebugNode[];
  edges?: DebugEdge[];
};

type DebugValue = {
  type?: string;
  content?: unknown;
};

const BUSINESS_NODE_TYPES = new Set([
  'conversation_understanding',
  'reply_policy',
  'knowledge_retrieve',
  'answerability_gate',
  'llm_reply',
  'analyze_conversation',
  'prepare_ticket_draft',
  'human_confirm',
  'create_ticket',
  'handoff_to_human',
  'send_reply',
]);

export function isBusinessDebugSchema(input: TaskRunInput): boolean {
  const schema = parseSchema(input.schema);
  return (schema.nodes ?? []).some((node) => BUSINESS_NODE_TYPES.has(node.type));
}

export function buildBusinessDebugReport(input: TaskRunInput, taskID: string): IReport {
  const schema = parseSchema(input.schema);
  const nodes = schema.nodes ?? [];
  const nodesByID = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, DebugEdge[]>();
  for (const edge of schema.edges ?? []) {
    outgoing.set(edge.sourceNodeID, [...(outgoing.get(edge.sourceNodeID) ?? []), edge]);
  }

  const values = new Map<string, WorkflowOutputs>();
  const reports: IReport['reports'] = {};
  const startedAt = Date.now();
  let current = nodes.find((node) => node.type === 'start');
  let workflowOutputs: WorkflowOutputs = { status: 'completed', debug: true };

  for (let step = 0; current && step < 128; step += 1) {
    const nodeInputs = resolveNodeInputs(current, values);
    const nodeOutputs = simulateNode(current, nodeInputs, input.inputs);
    values.set(current.id, nodeOutputs);
    const now = Date.now();
    reports[current.id] = {
      id: current.id,
      status: WorkflowStatus.Succeeded,
      terminated: true,
      startTime: now,
      endTime: now,
      timeCost: 0,
      snapshots: [
        {
          id: `${taskID}-${current.id}`,
          nodeID: current.id,
          inputs: nodeInputs,
          outputs: nodeOutputs,
          data: { debug: true },
        },
      ],
    };
    if (current.type === 'end') {
      workflowOutputs = { ...nodeOutputs, status: 'completed', debug: true };
      break;
    }
    const nextEdge = (outgoing.get(current.id) ?? [])[0];
    current = nextEdge ? nodesByID.get(nextEdge.targetNodeID) : undefined;
  }

  const endedAt = Date.now();
  return {
    id: taskID,
    inputs: input.inputs,
    outputs: workflowOutputs,
    workflowStatus: {
      status: WorkflowStatus.Succeeded,
      terminated: true,
      startTime: startedAt,
      endTime: endedAt,
      timeCost: endedAt - startedAt,
    },
    reports,
    messages: {
      log: [],
      info: [],
      debug: [],
      error: [],
      warning: [],
    },
  };
}

function parseSchema(raw: string): DebugSchema {
  try {
    return JSON.parse(raw) as DebugSchema;
  } catch {
    return {};
  }
}

function resolveNodeInputs(
  node: DebugNode,
  values: Map<string, WorkflowOutputs>
): WorkflowInputs {
  return Object.fromEntries(
    Object.entries(node.data?.inputsValues ?? {}).map(([name, value]) => [
      name,
      resolveValue(value, values),
    ])
  );
}

function resolveValue(value: DebugValue, values: Map<string, WorkflowOutputs>): unknown {
  if (value?.type === 'ref' && Array.isArray(value.content)) {
    const [nodeID, field] = value.content;
    if (typeof nodeID === 'string' && typeof field === 'string') {
      return values.get(nodeID)?.[field];
    }
  }
  return value?.content;
}

function simulateNode(
  node: DebugNode,
  inputs: WorkflowInputs,
  workflowInputs: WorkflowInputs
): WorkflowOutputs {
  const userMessage = String(workflowInputs.userMessage ?? workflowInputs.query ?? '测试消息');
  switch (node.type) {
    case 'start':
      return { ...workflowInputs, userMessage, query: userMessage };
    case 'conversation_understanding':
      return {
        normalizedMessage: userMessage,
        messageIntent: 'ticket_request',
        answerScope: 'needs_ticket',
        confidence: 1,
        riskSignals: [],
        reason: '调试模拟结果',
      };
    case 'reply_policy':
      return { action: 'prepare_ticket', requiresFlow: true, targetFlow: 'prepare_ticket' };
    case 'knowledge_retrieve':
      return { documents: [], count: 0, query: String(inputs.query ?? userMessage) };
    case 'answerability_gate':
      return { answerability: 'answerable', reason: '调试模拟结果' };
    case 'analyze_conversation':
      return { intent: 'ticket_request', riskLevel: 'low', needTicket: true };
    case 'prepare_ticket_draft': {
      const issue = String(inputs.issue ?? userMessage).trim() || '测试问题';
      const title = issue.length > 30 ? `${issue.slice(0, 30)}…` : issue;
      const ticketDraft = {
        ready: true,
        title,
        description: issue,
        missingFields: [],
        followUpQuestions: [],
        conversationFacts: [issue],
      };
      return { ticketDraft, ...ticketDraft };
    }
    case 'human_confirm':
      return { confirmed: true, responseText: '调试运行自动确认' };
    case 'create_ticket':
      return {
        ticketId: 0,
        ticketNo: '',
        created: false,
        skipped: true,
        message: '调试运行不会创建工单。',
      };
    case 'handoff_to_human':
      return { handoffId: 0, skipped: true, message: '调试运行不会转人工。' };
    case 'llm_reply': {
      const staticReply = String(node.data?.config?.staticReply ?? '').trim();
      return { replyText: staticReply || '调试回复' };
    }
    case 'send_reply':
      return { sent: Boolean(inputs.replyText), replyMessageId: 0 };
    case 'condition':
      return { matched: true };
    case 'end':
      return { ...inputs, status: 'completed' };
    default:
      return { ...inputs, debug: true };
  }
}
