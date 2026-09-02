// Drift negatives for the pinned tool surface: the comparison must catch a
// rename, a removal, an addition, and a duplicate -- and accept only the
// exact pinned set. Run: node scripts/test-tool-surface.mjs

import { compareToolSurface, expectedToolNames } from "./tool-surface.mjs";

const failures = [];

function expectFindings(label, actual, expectedCount) {
  const findings = compareToolSurface(actual);
  if (expectedCount === 0 && findings.length !== 0) {
    failures.push(`${label}: expected an exact match, got: ${findings.join("; ")}`);
  }
  if (expectedCount > 0 && findings.length === 0) {
    failures.push(`${label}: drift was not detected`);
  }
}

expectFindings("exact pinned set matches", [...expectedToolNames], 0);

const renamed = [...expectedToolNames];
renamed[renamed.indexOf("solver_submit")] = "solver_submit_v2";
expectFindings("a renamed tool fails", renamed, 2);

expectFindings("a removed tool fails", expectedToolNames.slice(1), 1);
expectFindings("an added tool fails", [...expectedToolNames, "solver_extra"], 1);
expectFindings("a duplicate fails", [...expectedToolNames, expectedToolNames[0]], 1);
expectFindings("18 names outside the surface fail", expectedToolNames.map((name) => `${name}_x`), 36);

if (expectedToolNames.length !== 18) failures.push(`pinned surface must have 18 names, has ${expectedToolNames.length}`);

if (failures.length > 0) {
  process.stderr.write(failures.map((failure) => `FAIL ${failure}`).join("\n") + "\n");
  process.exit(1);
}
process.stdout.write("tool-surface drift negatives ok (6 cases, 18 pinned names)\n");
