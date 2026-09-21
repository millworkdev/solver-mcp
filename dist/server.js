import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { readFileSync } from "node:fs";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from "@modelcontextprotocol/sdk/types.js";
import { SolverApiError, SolverApiNetworkError } from "./errors.js";
import { SolverBackendClient } from "./httpClient.js";
import { ToolInputError } from "./toolDefinition.js";
import { allTools, toolsByName } from "./tools/registry.js";
const packageMetadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
if (typeof packageMetadata.version !== "string" || packageMetadata.version.length === 0) {
    throw new Error("@millwork/solver-mcp package version is missing");
}
/** The version advertised during MCP initialization, sourced from the installed package. */
export const MCP_SERVER_VERSION = packageMetadata.version;
export const MILLWORK_WORKFLOW_INSTRUCTIONS = [
    "Use the Millwork organization API key already configured for this MCP server. " +
        "Provider credentials belong only on Millwork's private browser setup page; never ask the user to paste them into chat or a tool call.",
    "Begin with solver_list_sources and let the user choose the provider account. " +
        "Give the returned setup link only to that user to open in their regular browser. Browser completion is an intermediate step: poll it, save the returned provider scope unchanged, test the connection, refresh its available models, then call solver_list_model_catalog. Save the exact model the user chose from entries whose connection.connection_id matches that tested connection, using their arm_registration_template fields unchanged (solver_enable_model_arm supplies kind=model). Keep that connection_id with the returned arm_id.",
    "Before any state change, explain the action and get the user's approval. Before a paid run, name the task, provider account/connection, exact model, model-usage budget, and runtime limit. " +
        "Explain that the provider bills model usage and Millwork charges its platform fee when the run is accepted. The budget is not a hard cap on a provider call already in progress. Approval to connect an account is not approval to run a task.",
    "For a provider proof, submit with routing.required_arm_id set to the saved-model ID from that tested connection and do not switch accounts, models, or providers. " +
        "Completion requires a completed live status, a non-empty answer from solver_result, and a matching solver_receipt whose selected arm preserves the chosen connection, provider, and model.",
    "Stop at the first tool error and explain the failure and next decision without exposing secrets or private setup links. " +
        "Do not restart setup or try another write to hide the failure. Pending browser setup and a running task are not failures.",
    "Before disconnecting, identify the provider connection and affected saved models and get approval. Disconnecting disables the Millwork connection and its saved models; it does not revoke the provider's key or cancel calls already sent.",
    "For AWS Bedrock, use a short-term Bedrock API key for the normal API-key setup. Generate it in the AWS account and source Region the user intends to use. Leave Region blank only when the key was generated in us-east-1; otherwise enter its generation Region. " +
        "Region identifies where requests enter Bedrock and is not a data-residency guarantee. STS is a separate advanced setup choice; do not request STS fields or an inference-profile ARN for the API-key path.",
    // The public export replaces the following sentence in server.js before the deny-scan.
    "To attach a credential-less output check, use the installed @millwork/solver CLI: millwork verifier connect --endpoint <https-url> --access public --name <name> --version <version> --connect-only --json. For a protected check, use millwork verifier connect --endpoint <https-url> --access managed --name <name> --version <version> --stop-days 90 --connect-only --json (choose another supported stop period when needed), then open the returned continue_url and enter the key only on Millwork's private page. Never ask the user to paste an adapter secret or account key into a tool call. A failed contract is never ready. Connecting a check is not approval to run a task. Omit verifier_id on solver_submit only for the built-in output-presence baseline, which is not semantic verification. Protected adapter-key setup stays on Millwork's private browser page; the public MCP tools do not accept the key.",
].join("\n\n");
export function buildSolverMcpServer(backendOptions, serverOptions = {}) {
    const backend = new SolverBackendClient(backendOptions);
    const refuseBaselineSubmit = serverOptions.refuseBaselineSubmit === true;
    const server = new Server({ name: "@millwork/solver-mcp", version: MCP_SERVER_VERSION }, { capabilities: { tools: {} }, instructions: MILLWORK_WORKFLOW_INSTRUCTIONS });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: allTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            ...(tool.annotations ? { annotations: tool.annotations } : {}),
        })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const tool = toolsByName.get(request.params.name);
        if (tool === undefined) {
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool "${request.params.name}".`);
        }
        const args = (request.params.arguments ?? {});
        try {
            const result = await tool.handler(args, { backend, refuseBaselineSubmit });
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
