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
const docsUrl = ["https:", "//docs.getmillwork.dev"].join("");
const docsLookalikeUrl = ["https:", "//docs.getmillwork.dev", ".evil/help"].join("");
const nonpublicPath = ["docs/", "internal-notes", ".md"].join("");
const appKeysUrl = ["https:", "//app.getmillwork.dev", "/keys"].join("");
const appBillingUrl = ["https:", "//app.getmillwork.dev", "/billing"].join("");
const appOtherUrl = ["https:", "//app.getmillwork.dev", "/admin"].join("");
const appLookalikeUrl = ["https:", "//app.getmillwork.dev", ".evil/keys"].join("");
// A regex literal whose flags and method call mimic a path reference, and the
// same shape written in prose where no stripping applies.
const regexLiteralLine = ["/plan digest has ", "expired", "/i.test(detail)"].join("");
// Relative references in code files. Blanking regex literals out of the text
// erased these before they could be scanned, so each shape is pinned.
const missingDotSlash = ["./missing/", "note", ".md"].join("");
const missingDotDot = ["../outside/", "secret", ".md"].join("");
// Names that merely resemble regex flags. A suffix cannot establish that the
// scanner is looking at JavaScript, so nothing is exempted on one.
const flagLookalikeTest = ["fixtures/", "i", ".test"].join("");
const flagLookalikeExec = ["fixtures/", "g", ".exec"].join("");
const flagLookalikeFlags = ["fixtures/", "g", ".flags"].join("");
const escapingLookalike = ["../outside/", "i", ".test"].join("");
const namedPatternLine = ["EXPIRED_PLAN_DIGEST", "_DETAIL", ".test(detail)"].join("");

runCase("change-reference-rejects", "comment.js", `// works against the ${changeReference} backend\n`, "rejects", "internal-change-reference");
runCase("issue-reference-rejects", "notes.md", `Held behind ${issueReference} for now.\n`, "rejects", "internal-change-reference");
runCase("row-reference-rejects", "plan.md", `Deferred until ${rowReference} lands.\n`, "rejects", "internal-row-reference");
runCase("slice-reference-rejects", "history.js", `// the ${sliceReference} model chain\n`, "rejects", "internal-planning-term");
runCase("launch-reference-rejects", "roadmap.md", `Part of the ${launchReference} plan.\n`, "rejects", "launch-reference");
runCase("product-name-rejects", "readme.md", `Powered by ${productReference}.\n`, "rejects", "internal-product-name");
runCase("jargon-rejects", "tool.js", `// ${jargonReference}-only by construction\n`, "rejects", "superseded-jargon");
runCase("nonpublic-path-rejects", "guide.md", `See ${nonpublicPath} for details.\n`, "rejects", "not public here");
runCase("foreign-url-rejects", "links.md", `See ${foreignUrl} for details.\n`, "rejects", "URL outside the allowed public set");
runCase("docs-lookalike-url-rejects", "links.md", `See ${docsLookalikeUrl} for details.\n`, "rejects", "URL outside the allowed public set");
runCase(
  "support-link-accepts",
  "support.md",
  "Report problems at https://github.com/millworkdev/solver-mcp/issues — include the tool name and versions.\n",
  "accepts",
);
runCase(
  "documentation-link-accepts",
  "support.md",
  `Read the public documentation: ${docsUrl}\n`,
  "accepts",
);
mkdirSync(join(workDirectory, "private"), { recursive: true });
writeFileSync(join(workDirectory, "private", "secret.md"), "internal notes\n");
const escapingPath = ["../private/", "secret", ".md"].join("");
runCase("existing-sibling-outside-root-rejects", "guide.md", `See ${escapingPath} for details.\n`, "rejects", "not public here");

runCase("app-other-path-rejects", "links.md", `See ${appOtherUrl} for details.\n`, "rejects", "URL outside the allowed public set");
runCase("app-lookalike-url-rejects", "links.md", `See ${appLookalikeUrl} for details.\n`, "rejects", "URL outside the allowed public set");
runCase(
  "app-customer-links-accept",
  "guidance.md",
  `Create a key at ${appKeysUrl} and review spending at ${appBillingUrl}.\n`,
  "accepts",
);
runCase("missing-dot-slash-in-comment-rejects", "sample.js", `// See ${missingDotSlash} for details.\n`, "rejects", "not public here");
runCase("missing-dot-slash-in-string-rejects", "sample.js", `const note = "${missingDotSlash}";\n`, "rejects", "not public here");
runCase("missing-dot-dot-in-comment-rejects", "sample.js", `// See ${missingDotDot} for details.\n`, "rejects", "not public here");
runCase("missing-dot-dot-in-string-rejects", "sample.js", `const note = "${missingDotDot}";\n`, "rejects", "not public here");
runCase("inline-regex-literal-in-code-rejects", "guidance.js", `if (${regexLiteralLine}) return;\n`, "rejects", "not public here");
runCase("named-pattern-in-code-accepts", "guidance.js", `if (${namedPatternLine}) return;\n`, "accepts");
runCase("flag-lookalike-test-rejects", "sample.js", `// See ${flagLookalikeTest} for details.\n`, "rejects", "not public here");
runCase("flag-lookalike-exec-in-string-rejects", "sample.js", `const f = "${flagLookalikeExec}";\n`, "rejects", "not public here");
runCase("flag-lookalike-flags-rejects", "sample.js", `// See ${flagLookalikeFlags} for details.\n`, "rejects", "not public here");
runCase("regex-literal-in-prose-rejects", "notes.md", `Matched by ${regexLiteralLine}.\n`, "rejects", "not public here");
runCase("nonpublic-path-in-code-still-rejects", "helper.js", `${regexLiteralLine}; // per ${nonpublicPath}\n`, "rejects", "not public here");
runCase(
  "plain-public-prose-accepts",
  "about.md",
  "The server registers 18 tools over stdio and never accepts raw credential material.\n",
  "accepts",
);

{
  // An escaping reference whose name resembles regex flags, with the target
  // really present. This is the shape a suffix-based exemption let through.
  const caseDirectory = join(workDirectory, "existing-sibling-lookalike");
  mkdirSync(join(caseDirectory, "outside"), { recursive: true });
  mkdirSync(join(caseDirectory, "pub"), { recursive: true });
  writeFileSync(join(caseDirectory, "outside", "i.test"), "internal notes\n");
  writeFileSync(join(caseDirectory, "pub", "sample.js"), `// See ${escapingLookalike} for details.\n`);
  let rejected = false;
  let output = "";
  try {
    output = execFileSync("node", [scannerPath, join(caseDirectory, "pub")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    rejected = true;
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  if (!rejected || !output.includes("not public here")) {
    failures.push(`existing-sibling-lookalike-rejects: expected rejection, got: ${output.trim()}`);
  } else {
    console.log("ok existing-sibling-lookalike-rejects (rejects)");
  }
}

{
  // The dangerous shape: the escaping target really exists, and the reference
  // is inside a code file where literal-blanking used to remove it.
  const caseDirectory = join(workDirectory, "existing-sibling-code");
  mkdirSync(join(caseDirectory, "outside"), { recursive: true });
  mkdirSync(join(caseDirectory, "pub"), { recursive: true });
  writeFileSync(join(caseDirectory, "outside", "secret.md"), "internal notes\n");
  writeFileSync(join(caseDirectory, "pub", "sample.js"), `// See ${missingDotDot} for details.\n`);
  let rejected = false;
  let output = "";
  try {
    output = execFileSync("node", [scannerPath, join(caseDirectory, "pub")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    rejected = true;
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  if (!rejected || !output.includes("not public here")) {
    failures.push(`existing-sibling-in-code-rejects: expected rejection, got: ${output.trim()}`);
  } else {
    console.log("ok existing-sibling-in-code-rejects (rejects)");
  }
}

rmSync(workDirectory, { recursive: true, force: true });
if (failures.length > 0) {
  process.stderr.write(failures.map((failure) => `FAIL ${failure}`).join("\n") + "\n");
  process.exit(1);
}
process.stdout.write("public-content negative fixtures ok (30 cases)\n");
