import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type SolverBackendOptions } from "./httpClient.js";
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
export declare function buildSolverMcpServer(backendOptions: SolverBackendOptions): Server;
