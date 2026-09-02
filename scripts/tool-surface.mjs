// Canonical tool-surface comparison shared by the installed smoke and its
// drift negative. The expected set is pinned in expected-tool-surface.json;
// any addition, removal, or rename is a failure, not a warning.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const expectedSurfacePath = resolve(dirname(fileURLToPath(import.meta.url)), "expected-tool-surface.json");

export const expectedToolNames = JSON.parse(readFileSync(expectedSurfacePath, "utf8")).tool_names;

/** Returns a list of human-readable drift findings; empty means exact match. */
export function compareToolSurface(actualToolNames) {
  const findings = [];
  const actualSorted = [...actualToolNames].sort();
  const expectedSorted = [...expectedToolNames].sort();
  for (const name of expectedSorted) {
    if (!actualSorted.includes(name)) findings.push(`missing expected tool: ${name}`);
  }
  for (const name of actualSorted) {
    if (!expectedSorted.includes(name)) findings.push(`unexpected tool outside the pinned surface: ${name}`);
  }
  if (findings.length === 0 && actualSorted.length !== expectedSorted.length) {
    findings.push(`duplicate tool names: got ${actualSorted.length}, expected ${expectedSorted.length}`);
  }
  return findings;
}
