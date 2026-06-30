import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import ts from "typescript"

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

async function loadModule() {
  const source = await readFile(new URL("./workflow-utils.ts", import.meta.url), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.CommonJS,
    },
    fileName: "workflow-utils.ts",
  })
  const sandbox = {
    exports: {},
    module: { exports: {} },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(compiled.outputText, sandbox)
  return sandbox.module.exports
}

function workflowNode(id, type, position = { x: 0, y: 0 }, data = {}) {
  return {
    id,
    type,
    meta: { position },
    data: {
      title: type,
      config: {},
      inputsValues: {},
      ...data,
    },
  }
}

function workflowEdge(sourceNodeID, targetNodeID, extra = {}) {
  return {
    sourceNodeID,
    targetNodeID,
    ...extra,
  }
}

describe("FlowGram value helpers", () => {
  it("creates and reads reference values", async () => {
    const { createRefValue, isRefValue, refField, refNodeId } = await loadModule()

    const value = createRefValue("start_1", "userMessage")

    assert.deepEqual(plain(value), { type: "ref", content: ["start_1", "userMessage"] })
    assert.equal(isRefValue(value), true)
    assert.equal(refNodeId(value), "start_1")
    assert.equal(refField(value), "userMessage")
    assert.equal(isRefValue({ type: "constant", content: "hello" }), false)
  })
})

describe("validateWorkflowDefinition", () => {
  it("rejects a workflow without exactly one start node", async () => {
    const { validateWorkflowDefinition } = await loadModule()

    const result = validateWorkflowDefinition({
      schemaVersion: 2,
      nodes: [workflowNode("end_1", "end")],
      edges: [],
    })

    assert.equal(result.valid, false)
    assert.match(result.errors.join("\n"), /exactly one start/)
  })

  it("rejects dangling FlowGram edges", async () => {
    const { validateWorkflowDefinition } = await loadModule()

    const result = validateWorkflowDefinition({
      schemaVersion: 2,
      nodes: [workflowNode("start_1", "start"), workflowNode("end_1", "end")],
      edges: [workflowEdge("start_1", "missing_1")],
    })

    assert.equal(result.valid, false)
    assert.match(result.errors.join("\n"), /target node does not exist: missing_1/)
  })

  it("rejects missing required inputs from node specs", async () => {
    const { validateWorkflowDefinition } = await loadModule()

    const result = validateWorkflowDefinition(
      {
        schemaVersion: 2,
        nodes: [
          workflowNode("start_1", "start"),
          workflowNode("reply_1", "send_reply", { x: 240, y: 0 }, { title: "发送回复" }),
          workflowNode("end_1", "end", { x: 480, y: 0 }),
        ],
        edges: [workflowEdge("start_1", "reply_1"), workflowEdge("reply_1", "end_1")],
      },
      [
        {
          type: "send_reply",
          title: "发送回复",
          inputSchema: [{ name: "replyText", label: "回复内容", type: "string", required: true }],
        },
      ]
    )

    assert.equal(result.valid, false)
    assert.match(result.errors.join("\n"), /发送回复 missing required input: 回复内容/)
  })

  it("accepts a valid schema v2 workflow", async () => {
    const { createRefValue, validateWorkflowDefinition } = await loadModule()

    const result = validateWorkflowDefinition(
      {
        schemaVersion: 2,
        nodes: [
          workflowNode("start_1", "start"),
          workflowNode("reply_1", "send_reply", { x: 240, y: 0 }, {
            inputsValues: { replyText: createRefValue("start_1", "userMessage") },
          }),
          workflowNode("end_1", "end", { x: 480, y: 0 }),
        ],
        edges: [workflowEdge("start_1", "reply_1"), workflowEdge("reply_1", "end_1")],
      },
      [
        {
          type: "send_reply",
          inputSchema: [{ name: "replyText", type: "string", required: true }],
        },
      ]
    )

    assert.deepEqual(plain(result), { valid: true, errors: [] })
  })
})

describe("createWorkflowNodeFromSpec", () => {
  it("creates a FlowGram schema v2 node with default inputs", async () => {
    const { createWorkflowNodeFromSpec } = await loadModule()

    const node = createWorkflowNodeFromSpec(
      {
        type: "llm_reply",
        title: "AI 回复",
        defaultInputs: {
          userMessage: { type: "ref", content: ["start_1", "userMessage"] },
        },
      },
      [{ id: "llm_reply_1" }],
      { x: 120, y: 240 }
    )

    assert.deepEqual(plain(node), {
      id: "llm_reply_2",
      type: "llm_reply",
      meta: { position: { x: 120, y: 240 } },
      data: {
        title: "AI 回复",
        config: {},
        inputsValues: {
          userMessage: { type: "ref", content: ["start_1", "userMessage"] },
        },
      },
    })
  })
})

describe("getAvailableVariables", () => {
  it("returns upstream output variables in dependency order", async () => {
    const { getAvailableVariables } = await loadModule()

    const variables = getAvailableVariables(
      {
        schemaVersion: 2,
        nodes: [
          workflowNode("start_1", "start", { x: 0, y: 0 }, { title: "开始" }),
          workflowNode("retrieve_1", "knowledge_retrieve", { x: 240, y: 0 }, { title: "知识检索" }),
          workflowNode("reply_1", "llm_reply", { x: 480, y: 0 }, { title: "AI 回复" }),
          workflowNode("end_1", "end", { x: 720, y: 0 }),
        ],
        edges: [
          workflowEdge("start_1", "retrieve_1"),
          workflowEdge("retrieve_1", "reply_1"),
          workflowEdge("reply_1", "end_1"),
        ],
      },
      "reply_1",
      [
        {
          type: "start",
          outputSchema: [{ name: "userMessage", label: "用户消息", type: "string", description: "input" }],
        },
        {
          type: "knowledge_retrieve",
          outputSchema: [{ name: "documents", label: "文档", type: "array<object>", description: "docs" }],
        },
      ]
    )

    assert.deepEqual(plain(variables), [
      {
        nodeId: "start_1",
        nodeName: "开始",
        field: "userMessage",
        label: "用户消息",
        type: "string",
        description: "input",
      },
      {
        nodeId: "retrieve_1",
        nodeName: "知识检索",
        field: "documents",
        label: "文档",
        type: "array<object>",
        description: "docs",
      },
    ])
  })
})

describe("workflow variable display helpers", () => {
  it("builds business-first variable options with technical details", async () => {
    const { buildVariableOption } = await loadModule()

    assert.deepEqual(plain(buildVariableOption({
      nodeId: "start_1",
      nodeName: "开始",
      field: "userMessage",
      label: "用户消息",
      type: "string",
      description: "客户本轮发送的消息内容",
    })), {
      value: "start_1.userMessage",
      label: "开始 / 用户消息",
      subtitle: "start_1.userMessage · string",
      description: "客户本轮发送的消息内容",
    })
  })

  it("builds variable spec display rows for readonly node outputs", async () => {
    const { buildVariableSpecDisplay } = await loadModule()

    assert.deepEqual(plain(buildVariableSpecDisplay({
      name: "replyText",
      label: "回复内容",
      type: "string",
      description: "发送给客户的最终回复文本",
    })), {
      key: "replyText",
      label: "回复内容",
      subtitle: "replyText · string",
      description: "发送给客户的最终回复文本",
    })
  })
})

describe("workflow branch interaction helpers", () => {
  it("detects branch row action targets inside buttons", async () => {
    const { isBranchRowActionTarget } = await loadModule()

    assert.equal(isBranchRowActionTarget({
      closest(selector) {
        return selector === "button" ? {} : null
      },
    }), true)
    assert.equal(isBranchRowActionTarget({
      closest() {
        return null
      },
    }), false)
  })

  it("clears workflow selection only when clicking outside preserved regions", async () => {
    const { shouldClearWorkflowSelectionOnPointerDown } = await loadModule()

    assert.equal(shouldClearWorkflowSelectionOnPointerDown({
      closest(selector) {
        return selector === "[data-workflow-preserve-selection]" ? {} : null
      },
    }), false)
    assert.equal(shouldClearWorkflowSelectionOnPointerDown({
      closest() {
        return null
      },
    }), true)
  })
})

describe("workflow definition mutations", () => {
  it("updates node data without changing unrelated nodes", async () => {
    const { updateWorkflowNodeData } = await loadModule()
    const definition = {
      schemaVersion: 2,
      nodes: [
        workflowNode("start_1", "start"),
        workflowNode("reply_1", "send_reply", { x: 240, y: 0 }),
      ],
      edges: [workflowEdge("start_1", "reply_1")],
    }

    const next = updateWorkflowNodeData(definition, "reply_1", {
      title: "发送回复",
      config: { staticReply: "hello" },
      inputsValues: {},
    })

    assert.equal(next.nodes[0].data.title, "start")
    assert.deepEqual(plain(next.nodes[1].data), {
      title: "发送回复",
      config: { staticReply: "hello" },
      inputsValues: {},
    })
  })

  it("deletes non-start nodes and related edges while keeping start protected", async () => {
    const { deleteWorkflowNode } = await loadModule()
    const definition = {
      schemaVersion: 2,
      nodes: [
        workflowNode("start_1", "start"),
        workflowNode("reply_1", "send_reply", { x: 240, y: 0 }),
        workflowNode("end_1", "end", { x: 480, y: 0 }),
      ],
      edges: [workflowEdge("start_1", "reply_1"), workflowEdge("reply_1", "end_1")],
    }

    const next = deleteWorkflowNode(definition, "reply_1")
    assert.deepEqual(next.nodes.map((node) => node.id), ["start_1", "end_1"])
    assert.deepEqual(next.edges, [])

    const protectedDefinition = deleteWorkflowNode(definition, "start_1")
    assert.deepEqual(protectedDefinition, definition)

    const withoutEnd = deleteWorkflowNode(definition, "end_1")
    assert.deepEqual(withoutEnd.nodes.map((node) => node.id), ["start_1", "reply_1"])
    assert.deepEqual(withoutEnd.edges, [workflowEdge("start_1", "reply_1")])
  })

  it("upserts and deletes condition branches in node config", async () => {
    const { deleteConditionBranch, upsertConditionBranch } = await loadModule()
    const definition = {
      schemaVersion: 2,
      nodes: [
        workflowNode("condition_1", "condition", { x: 240, y: 0 }, {
          config: {
            branches: [{ id: "default", name: "默认", targetNodeId: "end_1", default: true }],
          },
        }),
        workflowNode("end_1", "end", { x: 480, y: 0 }),
      ],
      edges: [
        workflowEdge("condition_1", "end_1", { sourcePortID: "default" }),
      ],
    }

    const updated = upsertConditionBranch(definition, "condition_1", {
      id: "vip",
      name: "VIP",
      targetNodeId: "end_1",
      condition: {
        left: { type: "ref", content: ["start_1", "priority"] },
        operator: "eq",
        right: "vip",
      },
    })

    assert.deepEqual(plain(updated.nodes[0].data.config.branches.map((branch) => branch.id)), ["default", "vip"])

    updated.edges.push(workflowEdge("condition_1", "end_1", { sourcePortID: "vip" }))

    const deleted = deleteConditionBranch(updated, "condition_1", "vip")
    assert.deepEqual(plain(deleted.nodes[0].data.config.branches.map((branch) => branch.id)), ["default"])
    assert.deepEqual(plain(deleted.edges.map((edge) => edge.sourcePortID)), ["default"])
  })

  it("adds FlowGram source ports for condition edges without removing existing lines", async () => {
    const { normalizeConditionPortsForFlowgram } = await loadModule()
    const definition = {
      schemaVersion: 2,
      nodes: [
        workflowNode("condition_1", "condition", { x: 240, y: 0 }, {
          config: {
            branches: [
              { id: "vip", name: "VIP", targetNodeId: "vip_reply", condition: { operator: "eq" } },
              { id: "default", name: "默认", targetNodeId: "normal_reply", default: true },
            ],
          },
        }),
        workflowNode("vip_reply", "llm_reply", { x: 520, y: 0 }),
        workflowNode("normal_reply", "llm_reply", { x: 520, y: 120 }),
      ],
      edges: [
        workflowEdge("condition_1", "vip_reply"),
        workflowEdge("condition_1", "normal_reply"),
      ],
    }

    const next = normalizeConditionPortsForFlowgram(definition)

    assert.deepEqual(plain(next.nodes[0].data.portKeys), ["vip", "default"])
    assert.deepEqual(plain(next.nodes[0].data.ports), ["vip", "default"])
    assert.deepEqual(plain(next.edges), [
      workflowEdge("condition_1", "vip_reply", { sourcePortID: "vip" }),
      workflowEdge("condition_1", "normal_reply", { sourcePortID: "default" }),
    ])
  })

  it("syncs branch targets from condition source ports while preserving unrelated edges", async () => {
    const { syncConditionBranchTargetsFromEdges } = await loadModule()
    const definition = {
      schemaVersion: 2,
      nodes: [
        workflowNode("condition_1", "condition", { x: 240, y: 0 }, {
          config: {
            branches: [
              { id: "vip", name: "VIP", targetNodeId: "", condition: { operator: "eq" } },
              { id: "default", name: "默认", targetNodeId: "", default: true },
            ],
          },
          portKeys: ["vip", "default"],
          ports: ["vip", "default"],
        }),
        workflowNode("vip_reply", "llm_reply", { x: 520, y: 0 }),
        workflowNode("normal_reply", "llm_reply", { x: 520, y: 120 }),
      ],
      edges: [
        workflowEdge("condition_1", "vip_reply", { sourcePortID: "vip" }),
        workflowEdge("condition_1", "normal_reply", { sourcePortID: "default" }),
        workflowEdge("vip_reply", "normal_reply"),
      ],
    }

    const next = syncConditionBranchTargetsFromEdges(definition)

    assert.equal(next.nodes[0].data.config.branches[0].targetNodeId, "vip_reply")
    assert.equal(next.nodes[0].data.config.branches[1].targetNodeId, "normal_reply")
    assert.equal(next.edges.length, 3)
  })
})
