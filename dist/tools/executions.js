import { assertRequiredPresent, ToolInputError } from "../toolDefinition.js";
/**
 * The three live execution tools. Their inputSchemas mirror the backend's
 * current request contract and handlers remain thin HTTP passthroughs.
 */
// Inlined from the product contract §2.3 ExecutionRequest. The doc's
// MCP schema composes `allOf: [ExecutionRequest]` by $ref, but a $ref to a
// markdown file is not resolvable by an MCP client, so ExecutionRequest's
// own required fields (task, policy, verifier_id) are inlined here alongside
// the hard-required idempotency_key.
const taskSchema = {
    type: "object",
    required: ["objective"],
    properties: {
        objective: { type: "string", maxLength: 4000 },
        inputs_ref: {
            type: "object",
            required: ["kind"],
            properties: {
                kind: { enum: ["url_list", "url", "inline_json"] },
                url: { type: "string", format: "uri" },
                json: { type: "object" },
            },
        },
    },
};
const policySchema = {
    type: "object",
    required: ["data_classes", "budget"],
    properties: {
        data_classes: { type: "array", items: { enum: ["public", "sandbox", "tenant_internal"] }, minItems: 1 },
        budget: {
            type: "object",
            required: ["max_cost_usd", "max_runtime_s"],
            properties: {
                max_cost_usd: { type: "number", exclusiveMinimum: 0 },
                max_runtime_s: { type: "integer", minimum: 1 },
            },
        },
        cost_coefficient: { type: "number", minimum: 0, maximum: 1, default: 0.5 },
        on_eval: { type: "array", items: { enum: ["gate", "fallback", "repair_retry"] }, uniqueItems: true },
    },
};
/**
 * `solver_submit` -> `POST /v1/executions`. `idempotency_key` is required IN
 * THIS SCHEMA (not merely in prose): the product contract §1 makes the
 * Idempotency-Key mandatory on POST /v1/executions, and an MCP client that
 * silently generated its own key per call would defeat the safe-replay
 * guarantee (the server documentation's "Idempotency is not optional"). Keeping it
 * in `required` means the schema itself rejects a call that omits it.
 */
export const submitTool = {
    name: "solver_submit",
    description: "Submit a task for governed execution (POST /v1/executions). Requires a " +
        "unique request ID via idempotency_key (sent as the Idempotency-Key header) -- " +
        "an MCP client cannot construct a valid call without it.",
    inputSchema: {
        type: "object",
        required: ["task", "policy", "verifier_id", "idempotency_key"],
        properties: {
            task: taskSchema,
            policy: policySchema,
            verifier_id: { type: "string" },
            compose: { enum: ["auto"], default: "auto" },
            idempotency_key: {
                type: "string",
                description: "A unique request ID for this call, sent as the Idempotency-Key header " +
                    "(the product contract §1). Hard-required by this schema, not prose -- " +
                    "an MCP client cannot construct a valid call without it.",
            },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_submit", submitTool.inputSchema, args);
        const { idempotency_key: idempotencyKey, ...body } = args;
        if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
            throw new ToolInputError('solver_submit: "idempotency_key" must be a non-empty caller-owned value.');
        }
        return context.backend.request({
            method: "POST",
            path: "executions",
            body,
            idempotencyKey,
        });
    },
};
/** `solver_status` -> `GET /v1/executions/{id}`. */
export const statusTool = {
    name: "solver_status",
    description: "Poll an execution's lifecycle state (GET /v1/executions/{id}).",
    inputSchema: {
        type: "object",
        required: ["execution_id"],
        properties: { execution_id: { type: "string" } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_status", statusTool.inputSchema, args);
        return context.backend.request({
            method: "GET",
            path: `executions/${encodeURIComponent(String(args.execution_id))}`,
        });
    },
};
/** `solver_cancel` -> `POST /v1/executions/{id}/cancel`. */
export const cancelTool = {
    name: "solver_cancel",
    description: "Cancel a running execution (POST /v1/executions/{id}/cancel).",
    inputSchema: {
        type: "object",
        required: ["execution_id"],
        properties: { execution_id: { type: "string" } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_cancel", cancelTool.inputSchema, args);
        return context.backend.request({
            method: "POST",
            path: `executions/${encodeURIComponent(String(args.execution_id))}/cancel`,
        });
    },
};
/** `solver_result` -> `GET /v1/executions/{id}/result`. */
export const resultTool = {
    name: "solver_result",
    description: "Fetch the retention-bound result of a COMPLETED execution " +
        "(GET /v1/executions/{id}/result): the final text plus the winner attempt's " +
        "model provenance (requested vs resolved identity) when one exists.",
    inputSchema: {
        type: "object",
        required: ["execution_id"],
        properties: { execution_id: { type: "string" } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_result", resultTool.inputSchema, args);
        return context.backend.request({
            method: "GET",
            path: `executions/${encodeURIComponent(String(args.execution_id))}/result`,
        });
    },
};
//# sourceMappingURL=executions.js.map