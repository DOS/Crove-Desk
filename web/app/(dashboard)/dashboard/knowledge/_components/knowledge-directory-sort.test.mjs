import assert from "node:assert/strict"
import { describe, it } from "node:test"
import ts from "typescript"
import { readFile } from "node:fs/promises"
import vm from "node:vm"

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

async function loadModule() {
  const source = await readFile(
    new URL("./knowledge-directory-sort.ts", import.meta.url),
    "utf8"
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.CommonJS,
    },
    fileName: "knowledge-directory-sort.ts",
  })
  const sandbox = {
    exports: {},
    module: { exports: {} },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(compiled.outputText, sandbox)
  return sandbox.module.exports
}

const tree = [
  { id: 1, parentId: 0, name: "A", children: [
    { id: 11, parentId: 1, name: "A-1", children: [] },
    { id: 12, parentId: 1, name: "A-2", children: [] },
  ] },
  { id: 2, parentId: 0, name: "B", children: [] },
  { id: 3, parentId: 0, name: "C", children: [] },
]

describe("knowledge directory sorting", () => {
  it("moves root directories within the same parent", async () => {
    const { moveDirectoryWithinParent } = await loadModule()

    const next = moveDirectoryWithinParent(tree, 0, 3, 1)

    assert.deepEqual(plain(next.items).map((item) => item.id), [3, 1, 2])
    assert.equal(next.changed, true)
    assert.equal(next.parentId, 0)
    assert.deepEqual(plain(next.orderedIds), [3, 1, 2])
  })

  it("moves child directories within their parent", async () => {
    const { moveDirectoryWithinParent } = await loadModule()

    const next = moveDirectoryWithinParent(tree, 1, 12, 11)

    assert.deepEqual(plain(next.items[0].children).map((item) => item.id), [12, 11])
    assert.equal(next.changed, true)
    assert.equal(next.parentId, 1)
    assert.deepEqual(plain(next.orderedIds), [12, 11])
  })

  it("does not move directories across parents", async () => {
    const { findDirectoryParentId, moveDirectoryWithinParent } = await loadModule()

    assert.equal(findDirectoryParentId(tree, 11), 1)
    assert.equal(findDirectoryParentId(tree, 2), 0)

    const next = moveDirectoryWithinParent(tree, 1, 11, 2)

    assert.equal(next.changed, false)
    assert.equal(next.items, tree)
    assert.deepEqual(plain(next.orderedIds), [])
  })

  it("moves a child directory back to the root level", async () => {
    const { moveDirectoryToParent } = await loadModule()

    const next = moveDirectoryToParent(tree, 11, 0)

    assert.equal(next.changed, true)
    assert.equal(next.parentId, 0)
    assert.equal(next.item?.parentId, 0)
    assert.deepEqual(plain(next.items).map((item) => item.id), [1, 2, 3, 11])
    assert.deepEqual(plain(next.items[0].children).map((item) => item.id), [12])
    assert.deepEqual(plain(next.orderedIds), [1, 2, 3, 11])
  })

  it("moves a root directory without children under another root directory", async () => {
    const { moveDirectoryToParent } = await loadModule()

    const next = moveDirectoryToParent(tree, 3, 2)

    assert.equal(next.changed, true)
    assert.equal(next.parentId, 2)
    assert.equal(next.item?.parentId, 2)
    assert.deepEqual(plain(next.items).map((item) => item.id), [1, 2])
    assert.deepEqual(plain(next.items[1].children).map((item) => item.id), [3])
    assert.deepEqual(plain(next.orderedIds), [3])
  })

  it("rejects moving a directory with children under another directory", async () => {
    const { moveDirectoryToParent } = await loadModule()

    const next = moveDirectoryToParent(tree, 1, 2)

    assert.equal(next.changed, false)
    assert.equal(next.items, tree)
  })

  it("rejects moving a directory under a child directory", async () => {
    const { moveDirectoryToParent } = await loadModule()

    const next = moveDirectoryToParent(tree, 3, 11)

    assert.equal(next.changed, false)
    assert.equal(next.items, tree)
  })
})
