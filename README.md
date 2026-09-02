# @millwork/solver-mcp

`@millwork/solver-mcp` is Millwork's local execution MCP server. It gives an
approved assistant 18 tenant-authenticated `solver_*` tools over stdio. Some
tools read state. Others connect sources, submit work, cancel a run, or decide a
proposal, so the server is write-capable.

This package is implemented but **unpublished**. The preview path below installs
a locally packed tarball. Do not use a registry install, `npx`, or `latest`.

## Install the unpublished preview

Requires Node 20 or Node 22.

Build and pack the candidate from this repository:

```bash
cd packages/mcp-server
npm ci
npm run build
npm pack --ignore-scripts
```

That command creates `millwork-solver-mcp-0.1.0.tgz`. In a clean directory,
install that exact local file and check the installed binary without a key:

```bash
mkdir millwork-mcp-preview
cd millwork-mcp-preview
npm init --yes
npm install --ignore-scripts /absolute/path/to/millwork-solver-mcp-0.1.0.tgz
./node_modules/.bin/solver-mcp --help
```

The absolute tarball path is intentional. A package name alone would ask the
public registry for a package that is not available.

## Configure stdio

Point the MCP client at the installed binary with no arguments. Supply these
four environment variables through the client's secret-aware environment
configuration. Do not paste their values into a prompt, log, screenshot, or
support report.

| Variable | Required | Meaning |
|---|---:|---|
| `SOLVERAPI_API_KEY` | yes | Tenant API key held by the server process and sent as bearer authentication. |
| `SOLVERAPI_BASE_URL` | yes | API base including `/v1`; the production-shaped value is `https://api.getmillwork.dev/v1`. |
| `SOLVERAPI_MAX_RETRIES` | no | Network/5xx retry limit. Default: `2`. It never widens the safe retry boundary. |
| `SOLVERAPI_RETRY_BACKOFF_MS` | no | Exponential-backoff base in milliseconds. Default: `500`. |

The transport contract is exact:

```text
command: /absolute/path/to/millwork-mcp-preview/node_modules/.bin/solver-mcp
arguments: none
transport: stdio
stdout: MCP JSON-RPC only
stderr: diagnostics
```

Client-specific file locations and configuration shapes are validated by the
separate M2-B client matrix. This page does not invent a second matrix.

## Use it with an assistant

Codex, Claude, Cursor, Gemini, or another MCP client can use the same authority
contract. Start with a read-only request:

```text
Use solver_list_sources and solver_list_source_connections to show what this
organization can see. Do not call a tool that requires human confirmation.
Return tool names and safe counts only. Do not print credentials or customer
content.
```

For a write-capable request, make the stop explicit:

```text
Prepare a solver_submit call but do not run it yet. Show the exact budget,
verifier, data classes, and caller-owned idempotency key. Wait for my explicit
confirmation before one call. If the outcome is uncertain, inspect status with
a read tool; do not submit again under a new key unless I confirm that new
intent.
```

Human confirmation is a client-side stop. The tenant API key still carries the
server-side permissions assigned to it. Confirmation does not turn a tenant-wide
machine key into a narrower credential.

## Authority reference

[`execution-mcp-authority.json`](../../contracts/developer-experience/execution-mcp-authority.json)
is the single authority source for all 18 tools. It records the mapped API
operations, authority class, confirmation rule, retry boundary, server-side
permission, and recovery guidance. Render the current contract on demand from
the repository root:

```bash
npm run dx:mcp:content:authority
```

The renderer reads the landed JSON directly. No second authority table is
maintained in this packet. Tool input and output schemas remain in
[`docs/MCP_SERVER.md`](../../docs/MCP_SERVER.md).

## Retry and recovery boundary

The landed M0 boundary divides the 18 tools into:

- 9 safe reads that may retry network and 5xx failures;
- `solver_submit`, which may retry only with the same caller-owned,
  non-empty idempotency key and the same request bytes; and
- 8 write-capable tools that make one attempt because they expose no
  caller-owned idempotency key.

For those eight tools, a network or 5xx failure is a failure, not an automatic
retry. The write might have applied before the response was lost. Inspect state
with a safe read or the existing REST/dashboard recovery path, then ask for
explicit human intent before another write-capable tool call. Do not imply that
raising `SOLVERAPI_MAX_RETRIES` makes those writes replay-safe.

Backend failures use RFC 7807. The MCP error result keeps the parsed Problem in
`structuredContent.problem`; transport failures use `network_error`. See
[`EXECUTION_MCP_RECOVERY.md`](../../contracts/developer-experience/EXECUTION_MCP_RECOVERY.md)
for deterministic next actions across every promised failure class.

## Prepare a safe support report

No public package issue tracker, homepage, or vulnerability route exists yet.
The package manifest intentionally omits `repository`, `homepage`, and `bugs`
until the purpose-built public publishing repository exists and those routes
resolve. Do not replace an omitted route with a private or 404 URL.

Prepare a local report from the repository root before using the existing
private-preview support contact:

```bash
node scripts/sanitize-mcp-support-report.mjs raw-report.txt > safe-report.txt
```

Review `safe-report.txt` before it leaves the machine. Useful evidence includes
the tool name, retry boundary, attempt count, package/Node versions, and Problem
`type`, `title`, `status`, `instance`, and `retry_after_s`. Never include API or
provider credentials: omit your SolverAPI key, your provider key/account details,
authorization headers, customer task content, private paths, and tenant/resource
identifiers.

## Execution MCP and Docs MCP are separate

This package is tenant-authenticated and write-capable. The live Docs MCP is a
different retrieval-only, closed-world service with exactly
`search_millwork` and `query_docs_filesystem_millwork`. It has no SolverAPI
execution authority and receives no tenant key from this package.

The canonical Docs-MCP retrieval checks for this content packet remain
outstanding behind S1-B (#440), which is held by operator direction. This local
preview does not claim those checks passed and does not make the execution MCP
publicly available.

## Build and test from source

```bash
cd packages/mcp-server
npm ci
npm run build
npm test
```

The final live-backend test also needs this repository's migrated test database.
The suite covers the 18-tool registry, schemas, live route mappings, structured
errors, the M0 retry boundary, deterministic failure classes, CLI help, and the
live backend round trip. The package uses the official
`@modelcontextprotocol/sdk` runtime and a small copied HTTP/type layer; it is not
the TypeScript SDK and does not depend on it.
