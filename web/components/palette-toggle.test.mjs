import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const paletteSource = await readFile(
  new URL("./palette-toggle.tsx", import.meta.url),
  "utf8",
)
const layoutSource = await readFile(new URL("../app/(dashboard)/layout.tsx", import.meta.url), "utf8")
const zhMessages = JSON.parse(
  await readFile(new URL("../messages/zh-CN.json", import.meta.url), "utf8"),
)
const enMessages = JSON.parse(
  await readFile(new URL("../messages/en-US.json", import.meta.url), "utf8"),
)

test("plain palette is the default dashboard palette", () => {
  assert.match(paletteSource, /type PaletteMode = "plain" \| "blue" \| "green" \| "gray"/)
  assert.match(paletteSource, /const DEFAULT_PALETTE: PaletteMode = "plain"/)
  assert.match(layoutSource, /palette === "plain"/)
  assert.match(layoutSource, /: "plain"/)
})

test("plain palette is available in the palette menu and messages", () => {
  assert.match(paletteSource, /value: "plain"[\s\S]*labelKey: "palette\.plain"/)
  assert.equal(zhMessages.palette.plain, "默认")
  assert.equal(enMessages.palette.plain, "Default")
})
