#!/usr/bin/env node
export { buildSolverMcpServer } from "./server.js";
export type { SolverBackendOptions } from "./httpClient.js";
export { allTools, toolsByName } from "./tools/registry.js";
export type { ToolDefinition, JsonSchema } from "./toolDefinition.js";
