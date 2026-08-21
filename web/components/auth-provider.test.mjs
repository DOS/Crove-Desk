import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./session-provider.tsx", import.meta.url), "utf8");

test("refreshSession preserves the stored token when the profile payload omits it", () => {
  assert.match(source, /accessToken:\s*profile\.accessToken\s*\|\|\s*stored\.accessToken/);
  assert.match(source, /expiresAt:\s*profile\.expiresAt\s*\|\|\s*stored\.expiresAt/);
});

test("refreshSession only clears session for explicit auth error codes", () => {
  assert.match(source, /errorCode\s*===\s*3000\s*\|\|\s*errorCode\s*===\s*3002/);
  assert.doesNotMatch(source, /catch\s*\([^)]*\)\s*\{\s*clearSession\(\)/);
});
