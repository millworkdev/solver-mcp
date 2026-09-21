import type { ToolDefinition } from "../toolDefinition.js";
/**
 * The tool set of the server documentation: the original eight, plus the newer
 * model-access chain, the execution result, the connection-disconnect tool,
 * and the private V4 tenant-template list/plan/apply/status/resume tools.
 * Published @millwork/solver-mcp@0.2.2 has 19: the original 18 plus disconnect.
 * The 0.2.3 public export adds the catalog read for 20 and still excludes the
 * five tenant-template tools and the four public-path verifier tools.
 * No tool ever accepts or returns raw credential material.
 */
export declare const allTools: ToolDefinition[];
/** Lookup by tool name, for the CallTool dispatcher. */
export declare const toolsByName: ReadonlyMap<string, ToolDefinition>;
