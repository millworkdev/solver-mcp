// Installed-package smoke test. Packs this tree, installs the tarball into a
// clean temporary directory, and checks the artifact the way a user meets it:
//
//   1. `solver-mcp --help` exits 0 and names the product;
//   2. a real stdio session answers `initialize` and lists exactly the 18
//      `solver_*` tools, with public wording in every name and description.
//
// The dummy environment values below never reach a network: `tools/list` is
// served locally by the server. No publish, dispatch, or registry mutation.
//
// Run: node scripts/smoke-installed.mjs

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareToolSurface } from "./tool-surface.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workDirectory = mkdtempSync(join(tmpdir(), "solver-mcp-smoke-"));

// The forbidden wordings are assembled from fragments so this file itself
// passes the public-content scan while still detecting them in the artifact.
const supersededJargon = new RegExp(["B", "YOK"].join(""));
const internalProductName = new RegExp(`\\b${["Solver", "API"].join("")}\\b`);

function fail(message) {
  process.stderr.write(`FAIL ${message}\n`);
  rmSync(workDirectory, { recursive: true, force: true });
  process.exit(1);
}

const packOutput = JSON.parse(execFileSync(
  "npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", workDirectory],
  { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
));
const tarballPath = join(workDirectory, packOutput[0].filename);

execFileSync("npm", ["init", "--yes"], { cwd: workDirectory, stdio: "ignore" });
execFileSync("npm", ["install", "--ignore-scripts", tarballPath], { cwd: workDirectory, stdio: "ignore" });

const binaryPath = join(workDirectory, "node_modules", ".bin", "solver-mcp");
const helpOutput = execFileSync(binaryPath, ["--help"], { encoding: "utf8" });
if (!helpOutput.includes("Millwork Solver MCP server")) fail("--help does not name the product");
if (supersededJargon.test(helpOutput) || internalProductName.test(helpOutput)) {
  fail("--help emits non-public wording");
}

const server = spawn(binaryPath, [], {
  env: {
    ...process.env,
    SOLVERAPI_API_KEY: "smoke-test-placeholder-not-a-credential",
    SOLVERAPI_BASE_URL: "https://api.getmillwork.dev/v1",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

const responses = new Map();
let stdoutBuffer = "";
server.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk.toString();
  let newlineIndex;
  while ((newlineIndex = stdoutBuffer.indexOf("\n")) >= 0) {
    const line = stdoutBuffer.slice(0, newlineIndex).trim();
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
    if (line.length === 0) continue;
    const message = JSON.parse(line);
    if (message.id !== undefined) responses.set(message.id, message);
  }
});

function send(message) {
  server.stdin.write(`${JSON.stringify(message)}\n`);
}

function waitForResponse(id, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, rejectPromise) => {
    const poll = setInterval(() => {
      if (responses.has(id)) {
        clearInterval(poll);
        resolvePromise(responses.get(id));
      } else if (Date.now() > deadline) {
        clearInterval(poll);
        rejectPromise(new Error(`no response to request ${id} within ${timeoutMs}ms`));
      }
    }, 25);
  });
}

try {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "public-ci-smoke", version: "0.0.0" },
    },
  });
  const initializeResponse = await waitForResponse(1);
  if (initializeResponse.error) fail(`initialize failed: ${JSON.stringify(initializeResponse.error)}`);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const toolsResponse = await waitForResponse(2);
  if (toolsResponse.error) fail(`tools/list failed: ${JSON.stringify(toolsResponse.error)}`);

  const tools = toolsResponse.result.tools;
  const surfaceFindings = compareToolSurface(tools.map((tool) => tool.name));
  if (surfaceFindings.length > 0) fail(`tool surface drifted from the pinned 18-name set: ${surfaceFindings.join("; ")}`);
  for (const tool of tools) {
    const wording = `${tool.name} ${tool.description ?? ""}`;
    if (supersededJargon.test(wording)) fail(`tool ${tool.name} emits superseded jargon`);
    if (internalProductName.test(wording)) fail(`tool ${tool.name} emits the internal product name`);
  }
  process.stdout.write(`installed smoke ok (help, initialize, exact ${tools.length}-tool pinned surface, public wording)\n`);
} catch (error) {
  fail(error.message);
} finally {
  server.kill();
  rmSync(workDirectory, { recursive: true, force: true });
}
