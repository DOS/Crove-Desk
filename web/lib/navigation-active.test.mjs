import assert from "node:assert/strict"
import { describe, it } from "node:test"
import ts from "typescript"
import { readFile } from "node:fs/promises"
import vm from "node:vm"

async function loadModule() {
  const source = await readFile(
    new URL("./navigation-active.ts", import.meta.url),
    "utf8"
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2017,
      module: ts.ModuleKind.CommonJS,
    },
    fileName: "navigation-active.ts",
  })
  const sandbox = {
    exports: {},
    module: { exports: {} },
  }
  sandbox.exports = sandbox.module.exports
  vm.runInNewContext(compiled.outputText, sandbox)
  return sandbox.module.exports
}

describe("isDashboardNavItemActive", () => {
  it("matches exact dashboard paths and nested child routes", async () => {
    const { isDashboardNavItemActive } = await loadModule()

    assert.equal(isDashboardNavItemActive("/dashboard/tickets", "/dashboard/tickets"), true)
    assert.equal(
      isDashboardNavItemActive("/dashboard/tickets/123", "/dashboard/tickets"),
      true
    )
    assert.equal(
      isDashboardNavItemActive("/dashboard/tickets-extra", "/dashboard/tickets"),
      false
    )
    assert.equal(
      isDashboardNavItemActive(
        "/dashboard/wxwork-outbox",
        "/dashboard/channels"
      ),
      false
    )
  })

  it("only marks the dashboard home item active on the exact dashboard path", async () => {
    const { isDashboardNavItemActive } = await loadModule()

    assert.equal(isDashboardNavItemActive("/dashboard", "/dashboard"), true)
    assert.equal(isDashboardNavItemActive("/dashboard/tickets", "/dashboard"), false)
  })
})

describe("dashboardNavSectionHasActiveItem", () => {
  it("detects whether a sidebar group contains the current route", async () => {
    const { dashboardNavSectionHasActiveItem } = await loadModule()
    const items = [
      { url: "/dashboard/tags" },
      { url: "/dashboard/quick-replies" },
    ]

    assert.equal(
      dashboardNavSectionHasActiveItem(items, "/dashboard/quick-replies/create"),
      true
    )
    assert.equal(dashboardNavSectionHasActiveItem(items, "/dashboard/users"), false)
  })
})

describe("dashboard nav section storage helpers", () => {
  it("builds stable localStorage keys from section identifiers", async () => {
    const { getDashboardNavSectionStorageKey } = await loadModule()

    assert.equal(
      getDashboardNavSectionStorageKey("nav.receptionCenter"),
      "dashboard.sidebar.navSection.nav.receptionCenter.open"
    )
  })

  it("parses stored open states and ignores unknown values", async () => {
    const { parseDashboardNavSectionOpenState } = await loadModule()

    assert.equal(parseDashboardNavSectionOpenState("true"), true)
    assert.equal(parseDashboardNavSectionOpenState("false"), false)
    assert.equal(parseDashboardNavSectionOpenState(null), undefined)
    assert.equal(parseDashboardNavSectionOpenState("bad"), undefined)
  })
})
