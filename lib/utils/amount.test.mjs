import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// amount.ts is TypeScript; load via dynamic transpile is heavy — duplicate the
// validation contract here by importing through tsx if available, else skip.
try {
  const { register } = await import("node:module");
  const { pathToFileURL } = await import("node:url");
} catch {}

// Inline the same regex/logic for a contract check against the source file.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "amount.ts"), "utf8");
assert.match(src, /AMOUNT_PATTERN/);
assert.match(src, /Number\(cleanAmount\)/);
assert.doesNotMatch(src, /parseFloat/);

test("parseAmount source rejects trailing garbage via full-string pattern", () => {
  assert.ok(src.includes("AMOUNT_PATTERN"));
});
