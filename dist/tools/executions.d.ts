import { type ToolDefinition } from "../toolDefinition.js";
/**
 * `solver_submit` -> `POST /v1/executions`. `idempotency_key` is required IN
 * THIS SCHEMA (not merely in prose): the product contract §1 makes the
 * Idempotency-Key mandatory on POST /v1/executions, and an MCP client that
 * silently generated its own key per call would defeat the safe-replay
 * guarantee (the server documentation's "Idempotency is not optional"). Keeping it
 * in `required` means the schema itself rejects a call that omits it.
 */
export declare const submitTool: ToolDefinition;
/** `solver_status` -> `GET /v1/executions/{id}`. */
export declare const statusTool: ToolDefinition;
/** `solver_cancel` -> `POST /v1/executions/{id}/cancel`. */
export declare const cancelTool: ToolDefinition;
/** `solver_result` -> `GET /v1/executions/{id}/result`. */
export declare const resultTool: ToolDefinition;
