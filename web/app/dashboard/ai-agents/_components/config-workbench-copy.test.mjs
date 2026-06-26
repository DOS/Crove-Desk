import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const configWorkbenchSource = await readFile(new URL("./config-workbench.tsx", import.meta.url), "utf8")
const zhMessagesSource = await readFile(new URL("../../../../messages/zh-CN.json", import.meta.url), "utf8")

test("AI Agent workflow-era policy copy separates handoff execution from knowledge fallback", () => {
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
