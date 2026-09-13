import { assertRequiredPresent } from "../toolDefinition.js";
/**
 * The two arm tools that are fully functional today against the live
 * backend (arms CRUD is live). Both map 1:1 to a the product contract §3
 * endpoint and are thin passthroughs -- no shaping beyond what the API
 * returns, per the server documentation's "no hidden logic" rule.
 */
// Shared enum fragments, kept identical to the TypeScript SDK's ArmKind/CostClass/
// DataClass and the live backend's accepted values so this schema rejects
// exactly what the backend rejects.
const armKindEnum = { enum: ["model", "agent", "skill"] };
const costClassEnum = { enum: ["economy", "standard", "premium"] };
const dataClassEnum = { enum: ["public", "sandbox", "tenant_internal"] };
const endpointSchema = {
    type: "object",
    required: ["url", "auth_ref"],
    properties: {
        url: { type: "string", format: "uri" },
        auth_ref: { type: "string" },
    },
};
/**
 * `solver_register_arm` -> `POST /v1/arms`. The properties enumerate the Arm
 * write-shape (the product contract §2.1); required at the top level are
 * the kind-agnostic fields, matching the server documentation's register schema.
 * The backend does the full per-kind validation (e.g. model needs
 * provider/model_id, skill needs artifact) and returns a structured 400 when
 * a kind's own requirements are unmet, which the dispatcher relays.
 */
export const registerArmTool = {
    name: "solver_register_arm",
    description: "Register a model/agent/skill arm (POST /v1/arms). Returns the created arm, " +
        "including its arm_id, status, and (for skill kind) artifact_hash.",
    inputSchema: {
        type: "object",
        required: ["kind", "display_name", "capability_tags", "data_class_grants"],
        properties: {
            kind: armKindEnum,
            display_name: { type: "string" },
            capability_tags: { type: "array", items: { type: "string" } },
            data_class_grants: { type: "array", items: dataClassEnum },
            cost_class: costClassEnum,
            provider: { type: "string", description: "model kind: the inference provider." },
            model_id: { type: "string", description: "model kind: the provider's model identifier." },
            credential_ref: { type: "string", description: "Brokered credential handle; the raw secret never transits this API." },
            endpoint: {
                ...endpointSchema,
                description: "agent kind: the agent's callable endpoint (brokered auth_ref).",
            },
            lifecycle: {
                type: "object",
                properties: {
                    long_running: { type: "boolean" },
                    cancellable: { type: "boolean" },
                    max_runtime_s: { type: "integer", minimum: 1 },
                },
            },
            artifact: {
                type: "object",
                required: ["content", "version", "editable_regions"],
                properties: {
                    content: { type: "string" },
                    version: { type: "string" },
                    editable_regions: { type: "array", items: { type: "string" } },
                },
                description: "skill kind: the skill artifact; the backend hashes it into artifact_hash.",
            },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_register_arm", registerArmTool.inputSchema, args);
        // The whole argument object IS the arm write-body -- the register schema
        // carries only arm write-shape fields, no transport-level extras to strip.
        return context.backend.request({ method: "POST", path: "arms", body: args });
    },
};
/**
 * `solver_list_arms` -> `GET /v1/arms`. Returns `{ arms, next_cursor }`
 * exactly as the backend does -- cursor pagination is surfaced verbatim so an
 * MCP client drives it the same way a direct caller does (no auto-fetch of
 * further pages, matching the SDK's Paginated contract).
 */
export const listArmsTool = {
    name: "solver_list_arms",
    description: "List the tenant's registered arms (GET /v1/arms). Returns { arms, next_cursor }.",
    inputSchema: {
        type: "object",
        properties: {
            kind: armKindEnum,
            status: { enum: ["ready", "degraded", "disabled"] },
            cursor: { type: "string" },
            limit: { type: "integer", minimum: 1 },
        },
    },
    async handler(args, context) {
        return context.backend.request({
            method: "GET",
            path: "arms",
            query: {
                kind: args.kind,
                status: args.status,
                cursor: args.cursor,
                limit: args.limit,
            },
        });
    },
};
/**
 * `solver_enable_model_arm` -> `POST /v1/arms` with `kind: "model"` pinned.
 * The deployment-bound registration path: claims wider than the deployment's
 * certified template are rejected server-side, and no credential material is
 * involved -- the deployment already carries the connection binding.
 */
export const enableModelArmTool = {
    name: "solver_enable_model_arm",
    description: "Save the exact catalog model the user chose from the just-tested provider connection (POST /v1/arms with kind=model and model_deployment_id). " +
        "Confirm the catalog entry's connection_id matches that connection and use its arm_registration_template values unchanged. Keep that connection_id with the returned arm_id and pass the arm_id as solver_submit routing.required_arm_id.",
    inputSchema: {
        type: "object",
        required: ["model_deployment_id", "display_name", "capability_tags", "data_class_grants", "cost_class"],
        additionalProperties: false,
        properties: {
            model_deployment_id: { type: "string", description: "Exact catalog model deployment chosen by the user after matching its connection_id to the just-tested provider connection." },
            display_name: { type: "string" },
            capability_tags: { type: "array", items: { type: "string" } },
            data_class_grants: { type: "array", items: { type: "string", enum: ["public", "sandbox", "tenant_internal"] } },
            cost_class: costClassEnum,
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_enable_model_arm", enableModelArmTool.inputSchema, args);
        return context.backend.request({
            method: "POST",
            path: "arms",
            body: { kind: "model", ...args },
        });
    },
};
