import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type SolverBackendOptions } from "./httpClient.js";
/** The version advertised during MCP initialization, sourced from the installed package. */
export declare const MCP_SERVER_VERSION: string;
export declare const MILLWORK_WORKFLOW_INSTRUCTIONS: string;
/**
 * Assembles the MCP server: one authenticated backend client shared by every
 * tool (the server documentation -- "the MCP server authenticates once... every
 * tool call inherits that tenant scope"), a ListTools handler that advertises
 * the registry's literal inputSchemas, and a CallTool dispatcher that runs
 * the matching handler and maps any thrown error to the MCP error model.
 *
 * This builds the wired `Server` but does NOT connect a transport -- the
 * entrypoint (dist/index.js) attaches stdio. Keeping them separate lets a test
 * (or a future remote transport) construct the server without owning stdio.
 */
export interface SolverMcpServerOptions {
    /** J-D2 option. Off by default so published agents keep working. */
    refuseBaselineSubmit?: boolean;
}
export declare function buildSolverMcpServer(backendOptions: SolverBackendOptions, serverOptions?: SolverMcpServerOptions): Server;
