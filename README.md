# @millwork/solver-mcp

`@millwork/solver-mcp` is the Millwork Solver execution MCP server. It gives an
approved assistant 18 tenant-authenticated `solver_*` tools over stdio. Some
tools read state. Others connect model sources, submit work, cancel a run, or
decide a proposal, so the server is write-capable.

Versions publish under the `candidate` dist-tag. Pin the tag (or an exact
version) when installing.

## Install

Requires Node 20 or Node 22.

```bash
npm install --save-exact @millwork/solver-mcp@candidate
solver-mcp --help
```

Or run it directly:

```bash
npx --yes @millwork/solver-mcp@candidate --help
```

## Configure stdio

Point the MCP client at the `solver-mcp` binary with no arguments. Supply
these environment variables through the client's secret-aware environment
configuration. Do not paste their values into a prompt, log, screenshot, or
support report.

| Variable | Required | Meaning |
|---|---:|---|
| `SOLVERAPI_API_KEY` | yes | Tenant API key held by the server process and sent as bearer authentication. |
| `SOLVERAPI_BASE_URL` | yes | API base including `/v1`; the production value is `https://api.getmillwork.dev/v1`. |
| `SOLVERAPI_MAX_RETRIES` | no | Network/5xx retry limit. Default: `2`. It never widens the safe retry boundary. |
| `SOLVERAPI_RETRY_BACKOFF_MS` | no | Exponential-backoff base in milliseconds. Default: `500`. |

The transport contract is exact:

```text
command: solver-mcp
arguments: none
transport: stdio
stdout: MCP JSON-RPC only
stderr: diagnostics
```

## Use it with an assistant

Any MCP-capable assistant can use the same tool surface. Start with a
read-only request:

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
server-side permissions assigned to it. Confirmation does not turn a
tenant-wide machine key into a narrower credential.

## Tool surface

The server registers exactly 18 `solver_*` tools; `tools/list` over stdio is
the authoritative surface, and every tool description states what the tool
maps to and whether it writes. No tool ever accepts or returns raw credential
material: connecting a model source is a hosted browser handoff against your
own provider key/account, and the tools only ever carry an opaque handoff
intent id.

## Retry and recovery boundary

The 18 tools divide into:

- 9 safe reads that may retry network and 5xx failures;
- `solver_submit`, which may retry only with the same caller-owned,
  non-empty idempotency key and the same request bytes; and
- 8 write-capable tools that make one attempt because they expose no
  caller-owned idempotency key.

For those eight tools, a network or 5xx failure is a failure, not an automatic
retry. The write might have applied before the response was lost. Inspect
state with a safe read or your existing dashboard recovery path, then ask for
explicit human intent before another write-capable tool call. Raising
`SOLVERAPI_MAX_RETRIES` does not make those writes replay-safe.

Backend failures use RFC 7807. The MCP error result keeps the parsed Problem
in `structuredContent.problem`; transport failures use `network_error`.

## Support

Report problems on this repository's
[issue tracker](https://github.com/millworkdev/solver-mcp/issues). Useful
evidence includes the tool name, retry boundary, attempt count, package and
Node versions, and the Problem `type`, `title`, `status`, `instance`, and
`retry_after_s` fields. Never include credentials or customer content: omit
your tenant API key, your provider key/account details, authorization
headers, task content, and tenant or resource identifiers.

## Scope

This package is tenant-authenticated and write-capable. It is not a
documentation-retrieval service and receives no tenant key from any other
package. The Millwork documentation assistant is a separate, retrieval-only
service with no execution authority.
