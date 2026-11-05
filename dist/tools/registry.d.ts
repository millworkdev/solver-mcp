import type { ToolDefinition } from "../toolDefinition.js";
/**
 * The current private tool registry, including account inventory and exact
 * route permission. The immutable published authority and the separately
 * generated current public export declare their own bounded tool sets.
 * Registration here does not grant package publication or run authority.
 * No tool ever accepts or returns raw credential material.
 */
export declare const allTools: ToolDefinition[];
/** Lookup by tool name, for the CallTool dispatcher. */
export declare const toolsByName: ReadonlyMap<string, ToolDefinition>;
