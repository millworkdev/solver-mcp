import { type ToolDefinition } from "../toolDefinition.js";
/**
 * The provider-key model-source chain: list connectable sources, run the hosted
 * browser credential handoff, bind the connection, and list the
 * certification-backed deployments arms are enabled from.
 *
 * HARD INVARIANT (the server documentation): the MCP server NEVER accepts a raw
 * key, service-account JSON, cloud secret, or long-lived token. Connecting a
 * source is a browser handoff -- solver_start_source_handoff answers a
 * continue_url the human completes against the credential broker, and the
 * only thing these tools ever carry is the opaque handoff_intent_id.
 */
/** `solver_list_sources` -> `GET /v1/model-source-profiles`. */
export declare const listSourcesTool: ToolDefinition;
/** `solver_start_source_handoff` -> `POST /v1/source-credential-handoffs`. */
export declare const startSourceHandoffTool: ToolDefinition;
/** `solver_poll_source_handoff` -> `GET /v1/source-credential-handoffs/{id}`. */
export declare const pollSourceHandoffTool: ToolDefinition;
/** `solver_create_source_connection` -> `POST /v1/source-connections`. */
export declare const createSourceConnectionTool: ToolDefinition;
/** `solver_test_source_connection` -> `POST /v1/source-connections/{id}/test`. */
export declare const testSourceConnectionTool: ToolDefinition;
/** `solver_list_source_connections` -> `GET /v1/source-connections`. */
export declare const listSourceConnectionsTool: ToolDefinition;
/** `solver_sync_source_deployments` -> `POST /v1/source-connections/{id}/deployments/sync`. */
export declare const syncSourceDeploymentsTool: ToolDefinition;
/** `solver_list_model_deployments` -> `GET /v1/model-deployments`. */
export declare const listModelDeploymentsTool: ToolDefinition;
