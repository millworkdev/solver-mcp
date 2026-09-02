#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildSolverMcpServer } from "./server.js";
const HELP_TEXT = `Millwork Solver MCP server

Usage:
  solver-mcp

Required environment:
  SOLVERAPI_API_KEY     Tenant API key
  SOLVERAPI_BASE_URL    Solver API base URL, including /v1

Optional environment:
  SOLVERAPI_MAX_RETRIES       Network/5xx retry count (default: 2)
  SOLVERAPI_RETRY_BACKOFF_MS  Retry backoff base in milliseconds (default: 500)

Options:
  -h, --help            Show this help text
`;
// Re-exported so the server can be embedded/tested as a library, not only run
// as a CLI. Everything below this line is the stdio CLI entrypoint.
export { buildSolverMcpServer } from "./server.js";
export { allTools, toolsByName } from "./tools/registry.js";
/**
 * Reads the tenant credentials the server process holds on behalf of every
 * tool call (the server documentation -- the MCP server authenticates once; there
 * is no per-tool tenant parameter). Fails loudly on stderr rather than
 * starting a server that would 401 on the first call.
 */
function readBackendOptionsFromEnv() {
    const apiKey = process.env.SOLVERAPI_API_KEY;
    const baseUrl = process.env.SOLVERAPI_BASE_URL;
    if (!apiKey || !baseUrl) {
        throw new Error("The Millwork Solver MCP server requires SOLVERAPI_API_KEY and SOLVERAPI_BASE_URL " +
            "(production: SOLVERAPI_BASE_URL=https://api.getmillwork.dev/v1) in the environment.");
    }
    const maxRetries = process.env.SOLVERAPI_MAX_RETRIES;
    const retryBackoffMs = process.env.SOLVERAPI_RETRY_BACKOFF_MS;
    return {
        apiKey,
        baseUrl,
        maxRetries: maxRetries !== undefined ? Number(maxRetries) : undefined,
        retryBackoffMs: retryBackoffMs !== undefined ? Number(retryBackoffMs) : undefined,
    };
}
async function main() {
    if (process.argv.slice(2).some((argument) => argument === "--help" || argument === "-h")) {
        process.stdout.write(HELP_TEXT);
        return;
    }
    const server = buildSolverMcpServer(readBackendOptionsFromEnv());
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stdout is the MCP protocol channel over stdio -- diagnostics must go to
    // stderr so they never corrupt the JSON-RPC stream.
    process.stderr.write("Millwork Solver MCP server listening on stdio.\n");
}
// Only run the CLI when this module is the process entrypoint, so importing
// it as a library (e.g. from a test) does not try to bind stdio.
const entrypoint = process.argv[1];
const isMainModule = entrypoint !== undefined && import.meta.url === pathToFileURL(realpathSync(entrypoint)).href;
if (isMainModule) {
    main().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Millwork Solver MCP server failed to start: ${message}\n`);
        process.exit(1);
    });
}
