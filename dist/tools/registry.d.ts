import type { ToolDefinition } from "../toolDefinition.js";
/**
 * The tool set of the server documentation: the original eight, plus the newer
 * model-access chain (source listing -> hosted credential handoff ->
 * connection -> deployments -> deployment-bound arm enablement) and the
 * execution result. Ordered as a customer walks them: connect supply, enable
 * an arm, submit, observe, read the result and receipt, review repairs.
 * No tool ever accepts or returns raw credential material.
 */
export declare const allTools: ToolDefinition[];
/** Lookup by tool name, for the CallTool dispatcher. */
export declare const toolsByName: ReadonlyMap<string, ToolDefinition>;
