import { assertRequiredPresent, ToolInputError } from "../toolDefinition.js";
/**
 * The three live execution tools. Their inputSchemas mirror the backend's
 * current request contract and handlers remain thin HTTP passthroughs.
 */
// Inlined from the product contract §2.3 ExecutionRequest. The doc's
// MCP schema composes `allOf: [ExecutionRequest]` by $ref, but a $ref to a
// markdown file is not resolvable by an MCP client, so ExecutionRequest's
// own required fields (task, policy) are inlined here alongside the
// hard-required idempotency_key. verifier_id is optional: omitting it uses
// the backend's built-in output-presence baseline, not semantic verification.
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
    description: "Submit a live task using the exact saved model the user approved (POST /v1/executions). " +
        "Before calling, name the task, provider account/connection, exact model, model-usage budget, runtime limit, provider billing, and Millwork platform fee, then obtain explicit paid-run approval. " +
        "Set routing.required_arm_id to the chosen arm_id so another model cannot be selected. The budget is not a hard cap on a provider call already running. " +
        "Use a unique idempotency_key; omit verifier_id only for the built-in output-presence baseline, which is not semantic verification.",
    inputSchema: {
        type: "object",
        required: ["task", "policy", "idempotency_key"],
        properties: {
            task: taskSchema,
            policy: policySchema,
            verifier_id: { type: "string", minLength: 1 },
            mode: { enum: ["live", "echo"], default: "live" },
            routing: {
                type: "object",
                additionalProperties: false,
                required: ["required_arm_id"],
                properties: {
                    required_arm_id: {
                        type: "string",
                        minLength: 1,
                        description: "The exact saved-model arm_id the user chose. This prevents fallback to another model.",
                    },
                },
            },
            compose: { enum: ["auto"], default: "auto" },
            idempotency_key: {
                type: "string",
                description: "A unique request key for this submission. Reuse it only for the same request after an uncertain response.",
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
    description: "Read a run's progress or final outcome (GET /v1/executions/{id}). " +
        "Queued or running is not a failure; continue polling until the run reaches a terminal state.",
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
    description: "Read the model's answer from a completed live run (GET /v1/executions/{id}/result), " +
        "including requested and resolved model identity when available. Read the matching usage record separately with solver_receipt.",
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
