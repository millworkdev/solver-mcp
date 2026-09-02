import type { SolverBackendClient } from "./httpClient.js";
/**
 * A minimal JSON Schema shape -- enough to declare each tool's `inputSchema`
 * literally (docs/MCP_SERVER.md gives every tool as raw JSON Schema, so we
 * emit JSON Schema rather than translating through Zod, which would drop the
 * exact `required` lists the doc pins -- most importantly solver_submit's
 * required `idempotency_key`).
 */
export interface JsonSchema {
    type: "object";
    required?: string[];
    properties?: Record<string, unknown>;
    additionalProperties?: boolean;
    description?: string;
    [keyword: string]: unknown;
}
/** Everything a tool handler needs: the single authenticated backend client. */
export interface ToolContext {
    backend: SolverBackendClient;
}
/**
 * One MCP tool: its name, human description, the literal `inputSchema`
 * advertised to clients, and the handler that runs it. The handler returns
 * the value to JSON-serialize into the tool result; it throws on failure and
 * the dispatcher (src/server.ts) maps the thrown error to an MCP tool error.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: JsonSchema;
    handler(args: Record<string, unknown>, context: ToolContext): Promise<unknown>;
}
/**
 * Thrown when a call is missing a parameter the tool's own inputSchema marks
 * required. This is a first-line guard so a structurally-invalid call (e.g.
 * solver_submit without idempotency_key) fails locally with a clear message
 * instead of being forwarded to the backend -- the backend still does full
 * per-field validation, this only enforces top-level `required` presence.
 */
export declare class ToolInputError extends Error {
    constructor(message: string);
}
/**
 * Enforce a schema's top-level `required` array against the given arguments.
 * Only presence is checked here; type/enum/nested validation is the
 * backend's job (and is relayed as a structured 400 Problem when it fails).
 */
export declare function assertRequiredPresent(toolName: string, schema: JsonSchema, args: Record<string, unknown>): void;
