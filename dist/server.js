import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { SolverApiError, SolverApiNetworkError } from "./errors.js";
import { SolverBackendClient } from "./httpClient.js";
import { ToolInputError } from "./toolDefinition.js";
import { allTools, toolsByName } from "./tools/registry.js";
/**
 * Assembles the MCP server: one authenticated backend client shared by every
 * tool (the server documentation -- "the MCP server authenticates once... every
 * tool call inherits that tenant scope"), a ListTools handler that advertises
 * the eight tools' literal inputSchemas, and a CallTool dispatcher that runs
 * the matching handler and maps any thrown error to the MCP error model.
 *
 * This builds the wired `Server` but does NOT connect a transport -- the
 * entrypoint (dist/index.js) attaches stdio. Keeping them separate lets a test
 * (or a future remote transport) construct the server without owning stdio.
 */
export function buildSolverMcpServer(backendOptions) {
    const backend = new SolverBackendClient(backendOptions);
    const server = new Server({ name: "@millwork/solver-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: allTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
        })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const tool = toolsByName.get(request.params.name);
        if (tool === undefined) {
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool "${request.params.name}".`);
        }
        const args = (request.params.arguments ?? {});
        try {
            const result = await tool.handler(args, { backend });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: result,
            };
        }
        catch (error) {
            // A missing required parameter is a malformed call -> protocol-level
            // InvalidParams, not a tool-execution result.
            if (error instanceof ToolInputError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            return toToolErrorResult(error);
        }
    });
    return server;
}
/**
 * Maps a runtime failure to an `isError` tool result carrying STRUCTURED
 * error data, per the server documentation: a backend RFC-7807 Problem is surfaced
 * as the parsed body (not a flattened string), and a transport failure as a
 * network-error note.
 */
function toToolErrorResult(error) {
    if (error instanceof SolverApiError) {
        return {
            content: [{ type: "text", text: `${error.problem.title} (${error.problem.type})` }],
            structuredContent: { error: "solver_api_error", problem: error.problem },
            isError: true,
        };
    }
    if (error instanceof SolverApiNetworkError) {
        return {
            content: [{ type: "text", text: error.message }],
            structuredContent: { error: "network_error", message: error.message },
            isError: true,
        };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
        content: [{ type: "text", text: message }],
        structuredContent: { error: "unexpected_error", message },
        isError: true,
    };
}
