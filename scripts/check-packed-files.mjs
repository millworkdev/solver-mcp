// The packed artifact must contain exactly the allowlisted file set, and the
// manifest must tell the truth about this repository. Runs `npm pack
// --dry-run --json` (no tarball is written) and fails closed on any drift.
//
// Run: node scripts/check-packed-files.mjs

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// Source maps are deliberately not shipped: their referenced sources are
// not public here. The allowlist therefore has no .map entries.
const distFiles = [
  "errors", "httpClient", "index", "server", "toolDefinition", "types",
  "tools/arms", "tools/executions", "tools/modelSources", "tools/proposals",
  "tools/receipts", "tools/registry",
].flatMap((base) => [`dist/${base}.js`, `dist/${base}.d.ts`]);
const allowedPackedFiles = ["LICENSE", "README.md", "package.json", ...distFiles].sort();

const packOutput = JSON.parse(execFileSync(
  "npm", ["pack", "--dry-run", "--json", "--ignore-scripts"],
  { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
));
const packedFiles = packOutput[0].files.map((file) => file.path).sort();

if (JSON.stringify(packedFiles) !== JSON.stringify(allowedPackedFiles)) {
  const extra = packedFiles.filter((file) => !allowedPackedFiles.includes(file));
  const missing = allowedPackedFiles.filter((file) => !packedFiles.includes(file));
  if (extra.length > 0) failures.push(`packed files outside the allowlist: ${extra.join(", ")}`);
  if (missing.length > 0) failures.push(`allowlisted files missing from the pack: ${missing.join(", ")}`);
}

const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
if (manifest.name !== "@millwork/solver-mcp") failures.push(`manifest name is ${manifest.name}`);
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(manifest.version)) {
  failures.push(`manifest version ${manifest.version} is not stable SemVer`);
}
if (manifest.version === "0.1.0") failures.push("manifest version regressed to the immutable bootstrap version 0.1.0");
if (manifest.repository?.url !== "git+https://github.com/millworkdev/solver-mcp.git") {
  failures.push(`manifest repository does not name this exact public repository: ${manifest.repository?.url}`);
}
if (JSON.stringify(manifest.files) !== JSON.stringify(["dist"])) {
  failures.push(`manifest files must be exactly ["dist"], got ${JSON.stringify(manifest.files)}`);
}
if (JSON.stringify(manifest.bin) !== JSON.stringify({ "solver-mcp": "./dist/index.js" })) {
  failures.push(`manifest bin drifted: ${JSON.stringify(manifest.bin)}`);
}
if (manifest.publishConfig?.access !== "public") failures.push("manifest publishConfig.access must be public");
if (manifest.publishConfig?.provenance !== undefined) {
  failures.push("manifest must not force provenance; it comes from trusted publishing at publish time");
}
if (manifest.scripts && Object.keys(manifest.scripts).some((name) => name !== "start")) {
  failures.push(`manifest scripts must stay minimal, got ${Object.keys(manifest.scripts).join(", ")}`);
}

if (failures.length > 0) {
  process.stderr.write(failures.map((failure) => `FAIL ${failure}`).join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`packed-file check ok (${packedFiles.length} files, version ${manifest.version})\n`);
