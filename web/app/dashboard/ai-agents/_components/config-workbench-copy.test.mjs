import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const configWorkbenchSource = await readFile(new URL("./config-workbench.tsx", import.meta.url), "utf8")
const zhMessagesSource = await readFile(new URL("../../../../messages/zh-CN.json", import.meta.url), "utf8")
const adminApiSource = await readFile(new URL("../../../../lib/api/admin.ts", import.meta.url), "utf8")
const zhMessages = JSON.parse(zhMessagesSource)

test("AI Agent policy copy separates handoff execution from knowledge fallback", () => {
  const combinedSource = `${configWorkbenchSource}\n${zhMessagesSource}`

  assert.match(combinedSource, /转人工执行方式/)
  assert.match(combinedSource, /知识不足回复策略/)
  assert.match(combinedSource, /知识不足回复文案/)
  assert.match(combinedSource, /AI继续接待并提醒人工/)
  assert.match(combinedSource, /直接说明知识不足/)
  assert.match(combinedSource, /引导用户补充信息/)

  assert.doesNotMatch(configWorkbenchSource, /转人工模式/)
  assert.doesNotMatch(configWorkbenchSource, /兜底策略/)
  assert.doesNotMatch(configWorkbenchSource, /兜底文案/)
})

test("AI Agent config no longer exposes legacy graph tool routing knobs", () => {
  const aiAgentMessages = JSON.stringify(zhMessages.aiAgent ?? {})

  assert.doesNotMatch(configWorkbenchSource, /graphTools/)
  assert.doesNotMatch(adminApiSource, /graphTools/)
  assert.doesNotMatch(aiAgentMessages, /graphTools/)
  assert.doesNotMatch(aiAgentMessages, /Graph Tool/)
  assert.doesNotMatch(aiAgentMessages, /内置流程/)
})

test("AI Agent config uses one Agent Loop without a runtime mode selector", () => {
  assert.doesNotMatch(configWorkbenchSource, /runtimeMode/)
  assert.doesNotMatch(adminApiSource, /runtimeMode/)
  assert.doesNotMatch(configWorkbenchSource, /运行方式/)
  assert.doesNotMatch(configWorkbenchSource, /Workflow 是 Agent 的可选能力/)
  assert.doesNotMatch(configWorkbenchSource, /管理工作流/)
  assert.match(configWorkbenchSource, /写操作（需确认）/)
})

test("publishing an AI Agent saves the current form before publishing", () => {
  const publishFunction = configWorkbenchSource.match(
    /async function publishAgent\(\) \{([\s\S]*?)\n  \}/,
  )?.[1]

  assert.ok(publishFunction)
  assert.match(publishFunction, /const payload = buildPayload\(\)/)

  const saveIndex = publishFunction.indexOf(
    "await updateAIAgent({ id: agent.id, ...payload })",
  )
  const publishIndex = publishFunction.indexOf("await publishAIAgent(agent.id)")

  assert.ok(saveIndex >= 0)
  assert.ok(publishIndex > saveIndex)
  assert.match(publishFunction, /Agent 配置已保存并发布/)
})

test("saving a published AI Agent keeps the active revision online", () => {
  const saveFunction = configWorkbenchSource.match(
    /async function saveAgentSettings\(\) \{([\s\S]*?)\n  \}/,
  )?.[1]

  assert.ok(saveFunction)
  assert.match(configWorkbenchSource, /配置已保存，当前已发布版本继续生效/)
  assert.match(configWorkbenchSource, /已发布版本正在生效；再次发布后应用当前配置/)
  assert.doesNotMatch(saveFunction, /loadData\(\)/)
})

test("trusted MCP tools use backend risk metadata and cannot be edited", () => {
  assert.match(adminApiSource, /riskEditable: boolean/)
  assert.match(configWorkbenchSource, /riskLevel: tool\.riskLevel/)
  assert.match(configWorkbenchSource, /requireConfirmation: tool\.requireConfirmation/)
  assert.match(configWorkbenchSource, /只读（系统定义）/)
  assert.match(configWorkbenchSource, /!catalogTool\.riskEditable/)
})
