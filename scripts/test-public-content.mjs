// Negative fixtures for the public-content scanner. Each case writes a
// synthetic tree, points the exact committed scanner at it as a child
// process, and asserts the intended verdict — proving the scanner rejects
// internal change/row/launch references and other forbidden classes while
// accepting legitimate public content, including a public support link.
//
// Run: node scripts/test-public-content.mjs

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scannerPath = resolve(dirname(fileURLToPath(import.meta.url)), "check-public-content.mjs");
const workDirectory = mkdtempSync(join(tmpdir(), "public-content-fixtures-"));
const failures = [];

function runCase(caseName, fileName, content, expectation, expectedFragment = "") {
  const caseDirectory = join(workDirectory, caseName);
  mkdirSync(caseDirectory, { recursive: true });
  writeFileSync(join(caseDirectory, fileName), content);
  let output = "";
  let scannerFailed = false;
  try {
    output = execFileSync("node", [scannerPath, caseDirectory], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    scannerFailed = true;
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  if (expectation === "rejects" && !scannerFailed) {
    failures.push(`${caseName}: expected the scanner to reject, but it passed`);
  } else if (expectation === "accepts" && scannerFailed) {
    failures.push(`${caseName}: expected the scanner to accept, but it rejected: ${output.trim()}`);
  } else if (expectation === "rejects" && expectedFragment && !output.includes(expectedFragment)) {
    failures.push(`${caseName}: rejected for the wrong reason: ${output.trim()}`);
  } else {
    console.log(`ok ${caseName} (${expectation})`);
  }
}

// Assembled from fragments so this file passes the scan of the repository
// it lives in; the fixture files it writes into synthetic trees are the
// actual forbidden texts.
const changeReference = ["PR ", "#", "32"].join("");
const issueReference = ["issue ", "#", "440"].join("");
const rowReference = ["row ", "S4"].join("");
const sliceReference = ["Slice ", "C"].join("");
const launchReference = ["internal", "-launch"].join("");
const productReference = ["Solver", "API"].join("");
const jargonReference = ["B", "YOK"].join("");
const foreignUrl = ["https:", "//example", ".com/internal"].join("");
const nonpublicPath = ["docs/", "internal-notes", ".md"].join("");

runCase("change-reference-rejects", "comment.js", `// works against the ${changeReference} backend\n`, "rejects", "internal-change-reference");
runCase("issue-reference-rejects", "notes.md", `Held behind ${issueReference} for now.\n`, "rejects", "internal-change-reference");
runCase("row-reference-rejects", "plan.md", `Deferred until ${rowReference} lands.\n`, "rejects", "internal-row-reference");
runCase("slice-reference-rejects", "history.js", `// the ${sliceReference} model chain\n`, "rejects", "internal-planning-term");
runCase("launch-reference-rejects", "roadmap.md", `Part of the ${launchReference} plan.\n`, "rejects", "launch-reference");
runCase("product-name-rejects", "readme.md", `Powered by ${productReference}.\n`, "rejects", "internal-product-name");
runCase("jargon-rejects", "tool.js", `// ${jargonReference}-only by construction\n`, "rejects", "superseded-jargon");
runCase("nonpublic-path-rejects", "guide.md", `See ${nonpublicPath} for details.\n`, "rejects", "not public here");
runCase("foreign-url-rejects", "links.md", `See ${foreignUrl} for details.\n`, "rejects", "URL outside the allowed public set");
runCase(
  "support-link-accepts",
  "support.md",
  "Report problems at https://github.com/millworkdev/solver-mcp/issues — include the tool name and versions.\n",
  "accepts",
);
runCase(
  "plain-public-prose-accepts",
  "about.md",
  "The server registers 18 tools over stdio and never accepts raw credential material.\n",
  "accepts",
);

rmSync(workDirectory, { recursive: true, force: true });
if (failures.length > 0) {
  process.stderr.write(failures.map((failure) => `FAIL ${failure}`).join("\n") + "\n");
  process.exit(1);
}
process.stdout.write("public-content negative fixtures ok (11 cases)\n");
