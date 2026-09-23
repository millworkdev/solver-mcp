import { assertRequiredPresent, ToolInputError } from "../toolDefinition.js";
/**
 * Public-path verifier tools: list, show, credential-less connect, and retest.
 * They consume the existing verifier HTTP contract. Protected key entry stays
 * on the private customer page; these tools never accept a secret.
 */
const readOnlyHints = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
};
function probeSection(section) {
    return {
        status: section?.status ?? "not_checked",
        correction: section?.correction ?? null,
    };
}
function contractCheckFailed(probe) {
    if (probe.feedback?.response_compatibility?.status !== "ok")
        return true;
    return probe.contract?.validated !== true;
}
function connectionHeadline(status, probe) {
    if (contractCheckFailed(probe))
        return "not_ready";
    return status === "degraded" ? "degraded" : "ready";
}
function probeFacts(probe, declaration) {
    return {
        reachable: probeSection(probe.feedback?.reachability),
        authentication: probeSection(probe.feedback?.authentication),
        response_contract: probeSection(probe.feedback?.response_compatibility),
        declaration: {
            status: declaration?.status ?? "not_declared",
            statement: declaration?.statement ?? "Not declared",
        },
    };
}
function projectConnection(args) {
    const facts = probeFacts(args.probe, args.correctness_declaration);
    const headline = connectionHeadline(args.status, args.probe);
    return {
        operation: args.operation,
        access: args.access ?? "public",
        verifier_id: args.verifier_id,
        status: args.status,
        headline,
        facts,
        probe: args.probe,
        correctness_declaration: args.correctness_declaration ?? { status: "not_declared", statement: "Not declared" },
        ...args.extra,
    };
}
export const listVerifiersTool = {
    name: "solver_list_verifiers",
    description: "List registered output checks (GET /v1/verifiers). Read-only. " +
        "If no checks exist, returns a typed scaffold_output_check next action. " +
        "Does not connect, test, or start a run. Use solver_show_verifier for one check " +
        "and solver_connect_verifier to register a credential-less HTTPS endpoint.",
    annotations: { ...readOnlyHints },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
            cursor: { type: "string", minLength: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
        },
    },
    async handler(args, context) {
        const result = await context.backend.request({
            method: "GET",
            path: "verifiers",
            query: {
                ...(typeof args.cursor === "string" ? { cursor: args.cursor } : {}),
                ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
            },
        });
        if (Array.isArray(result.verifiers) && result.verifiers.length === 0 && !result.next_cursor) {
            return {
                ...result,
                state: "action_required",
                next_action: {
                    type: "scaffold_output_check",
                    surface: "cli",
                    command: "millwork verifier init <name> --recipe <0|a|b|c|d> --json",
                    detail: "No output checks are registered. Choose a Cookbook recipe, scaffold and test it locally, then connect its HTTPS endpoint before selecting a verifier_id for a run.",
                },
            };
        }
        return result;
    },
};
export const showVerifierTool = {
    name: "solver_show_verifier",
    description: "Read one registered output check (GET /v1/verifiers/{verifier_id}). Read-only. " +
        "Does not retest or start a run. An empty adapter handle means the check is credential-less.",
    annotations: { ...readOnlyHints },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["verifier_id"],
        properties: {
            verifier_id: { type: "string", minLength: 1 },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_show_verifier", showVerifierTool.inputSchema, args);
        return context.backend.request({
            method: "GET",
            path: `verifiers/${encodeURIComponent(String(args.verifier_id))}`,
        });
    },
};
export const connectVerifierTool = {
    name: "solver_connect_verifier",
    description: "Register or reuse an HTTPS output check (POST /v1/verifiers) and return four separate probe facts. " +
        "Requires access=public or managed, an https endpoint, display name, version, and a caller-owned idempotency_key. " +
        "Never pass an adapter secret, account key, or auth handle. A malformed handler is never reported as ready. " +
        "This does not start a model run. Protected adapter keys stay on Millwork's private browser setup page. " +
        "Omit verifier_id on a later solver_submit only for the output-presence baseline, which is not semantic verification.",
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["access", "endpoint", "name", "version", "idempotency_key"],
        properties: {
            access: {
                type: "string",
                enum: ["public", "managed"],
                description: "public is credential-less. managed registers the endpoint, then requires solver_start_verifier_connection; neither accepts a key.",
            },
            endpoint: { type: "string", minLength: 8 },
            name: { type: "string", minLength: 1 },
            version: { type: "string", minLength: 1 },
            data_class: { type: "string", enum: ["public", "sandbox", "tenant_internal"] },
            declare_deterministic: { type: "boolean" },
            idempotency_key: { type: "string", minLength: 1 },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_connect_verifier", connectVerifierTool.inputSchema, args);
        if (args.access !== "public" && args.access !== "managed") {
            throw new ToolInputError("solver_connect_verifier: access must be public or managed. Protected adapter keys are not accepted here.");
        }
        const endpoint = String(args.endpoint);
        if (!endpoint.startsWith("https://")) {
            throw new ToolInputError("solver_connect_verifier: endpoint must be an https URL.");
        }
        const idempotencyKey = String(args.idempotency_key);
        if (!idempotencyKey.trim()) {
            throw new ToolInputError('solver_connect_verifier: "idempotency_key" must be a non-empty caller-owned value.');
        }
        const dataClass = args.data_class === "sandbox" || args.data_class === "tenant_internal"
            ? args.data_class
            : "public";
        const outcome = await context.backend.request({
            method: "POST",
            path: "verifiers",
            idempotencyKey,
            body: {
                display_name: String(args.name),
                version: String(args.version),
                kind: "endpoint",
                endpoint: { url: endpoint, auth_ref: "" },
                input_data_classes: [dataClass],
                scoring: { correctness: "boolean_anchors", quality: "scalar_0_1" },
                ...(args.declare_deterministic === true
                    ? { correctness_declaration: { method: "deterministic" } }
                    : {}),
            },
        });
        const projected = projectConnection({
            operation: "verifier_connect",
            access: args.access,
            verifier_id: outcome.verifier_id,
            status: outcome.status,
            probe: outcome.preflight,
            correctness_declaration: outcome.correctness_declaration,
        });
        if (args.access === "managed") {
            return {
                ...projected,
                state: "action_required",
                next_action: {
                    type: "start_private_setup",
                    tool: "solver_start_verifier_connection",
                    required_nonsecret_inputs: ["verifier_id", "stop_choice", "idempotency_key"],
                    detail: "Start private setup for this verifier. Give the returned continue_url only to the intended person; the endpoint key never enters a tool call.",
                },
            };
        }
        return projected;
    },
};
const stopChoiceSchema = {
    oneOf: [
        {
            type: "object",
            additionalProperties: false,
            required: ["kind"],
            properties: { kind: { const: "no_expiration" } },
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["kind", "days"],
            properties: { kind: { const: "preset_days" }, days: { enum: [30, 90, 180, 365] } },
        },
        {
            type: "object",
            additionalProperties: false,
            required: ["kind", "date", "time_zone"],
            properties: {
                kind: { const: "calendar_date" },
                date: { type: "string", pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$" },
                time_zone: { type: "string", minLength: 1 },
            },
        },
    ],
};
function nonEmptyToolString(tool, field, value) {
    if (typeof value !== "string" || !value.trim()) {
        throw new ToolInputError(`${tool}: "${field}" must be a non-empty value returned by this workflow.`);
    }
    return value;
}
function validStopChoice(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const choice = value;
    if (choice.kind === "no_expiration")
        return Object.keys(choice).length === 1;
    if (choice.kind === "preset_days")
        return new Set([30, 90, 180, 365]).has(Number(choice.days));
    if (choice.kind !== "calendar_date" || typeof choice.date !== "string" || typeof choice.time_zone !== "string")
        return false;
    const parsed = new Date(`${choice.date}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(choice.date) || !Number.isFinite(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== choice.date)
        return false;
    try {
        new Intl.DateTimeFormat("en", { timeZone: choice.time_zone }).format();
        return true;
    }
    catch {
        return false;
    }
}
export const startVerifierConnectionTool = {
    name: "solver_start_verifier_connection",
    description: "Start private key setup for one registered output check (POST /v1/verifiers/{verifier_id}/connection-intents). " +
        "Returns a short-lived continue_url for the intended person and a safe intent_id for later inspection. " +
        "The endpoint key belongs only on that private page, never in chat or a tool call. This does not start a model run.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["verifier_id", "stop_choice", "idempotency_key"],
        properties: {
            verifier_id: { type: "string", minLength: 1 },
            stop_choice: stopChoiceSchema,
            idempotency_key: { type: "string", minLength: 1 },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_start_verifier_connection", startVerifierConnectionTool.inputSchema, args);
        const verifierId = nonEmptyToolString("solver_start_verifier_connection", "verifier_id", args.verifier_id);
        const idempotencyKey = nonEmptyToolString("solver_start_verifier_connection", "idempotency_key", args.idempotency_key);
        if (!validStopChoice(args.stop_choice)) {
            throw new ToolInputError("solver_start_verifier_connection: stop_choice must be no_expiration, 30/90/180/365 days, or a real calendar date with an IANA time zone.");
        }
        const intent = await context.backend.request({
            method: "POST",
            path: `verifiers/${encodeURIComponent(verifierId)}/connection-intents`,
            body: { stop_choice: args.stop_choice },
            idempotencyKey,
        });
        return {
            operation: "verifier_private_setup",
            state: "action_required",
            verifier_id: verifierId,
            ...intent,
            next_action: {
                type: "human_private_key_entry",
                tool: "solver_inspect_verifier_connection",
                argument_map: { verifier_id: "verifier_id", operation_key: "intent_id" },
                detail: "Give continue_url only to the intended person. After they finish or the handoff expires, pass this response's intent_id as operation_key to solver_inspect_verifier_connection; do not ask for the key.",
            },
        };
    },
};
export const inspectVerifierConnectionTool = {
    name: "solver_inspect_verifier_connection",
    description: "Read a protected output check's current connection and optionally one lifecycle operation " +
        "(GET /v1/verifiers/{verifier_id}/connection). Read-only and secretless. Use intent_id or operation_key from an earlier result to resume that exact operation.",
    annotations: { ...readOnlyHints },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["verifier_id"],
        properties: {
            verifier_id: { type: "string", minLength: 1 },
            operation_key: { type: "string", minLength: 1, maxLength: 256 },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_inspect_verifier_connection", inspectVerifierConnectionTool.inputSchema, args);
        const verifierId = nonEmptyToolString("solver_inspect_verifier_connection", "verifier_id", args.verifier_id);
        return context.backend.request({
            method: "GET",
            path: `verifiers/${encodeURIComponent(verifierId)}/connection`,
            query: typeof args.operation_key === "string" ? { operation_key: args.operation_key } : undefined,
        });
    },
};
function recordedOperation(value) {
    if (!value || Object.prototype.hasOwnProperty.call(value, "status"))
        return null;
    return value;
}
function pendingForOperation(view, operationKey) {
    const pending = view.pending_key;
    const last = recordedOperation(view.last_operation);
    if (!pending || !last || last.kind !== "stage" || last.phase !== "admitted")
        return null;
    if (last.resulting_state?.operation_key !== undefined && last.resulting_state.operation_key !== operationKey)
        return null;
    if (typeof pending.handle !== "string" || typeof pending.captured_generation !== "number"
        || last.resulting_state?.handle !== pending.handle)
        return null;
    return { handle: pending.handle, captured_generation: pending.captured_generation };
}
export const continueVerifierConnectionTool = {
    name: "solver_continue_verifier_connection",
    description: "Continue the exact protected setup/replacement/restore operation after private key entry. " +
        "Reads the named operation, tests only its staged opaque handle, promotes on success, and reads the recorded outcome. " +
        "Never accepts a raw endpoint key. Pass the start result's intent_id as operation_key and its expires_at as intent_expires_at. " +
        "Reuse operation_key after an unknown result; use a caller-owned idempotency_key for this HTTP attempt.",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["verifier_id", "operation_key", "intent_expires_at", "idempotency_key"],
        properties: {
            verifier_id: { type: "string", minLength: 1 },
            operation_key: { type: "string", minLength: 1, maxLength: 256 },
            intent_expires_at: { type: "string", minLength: 1 },
            idempotency_key: { type: "string", minLength: 1 },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_continue_verifier_connection", continueVerifierConnectionTool.inputSchema, args);
        const verifierId = nonEmptyToolString("solver_continue_verifier_connection", "verifier_id", args.verifier_id);
        const operationKey = nonEmptyToolString("solver_continue_verifier_connection", "operation_key", args.operation_key);
        const intentExpiresAt = nonEmptyToolString("solver_continue_verifier_connection", "intent_expires_at", args.intent_expires_at);
        const idempotencyKey = nonEmptyToolString("solver_continue_verifier_connection", "idempotency_key", args.idempotency_key);
        const expiresAt = Date.parse(intentExpiresAt);
        if (!Number.isFinite(expiresAt)) {
            throw new ToolInputError('solver_continue_verifier_connection: "intent_expires_at" must be the expiry returned by solver_start_verifier_connection.');
        }
        if (expiresAt <= Date.now()) {
            return {
                operation: "verifier_connection_continue",
                state: "expired",
                verifier_id: verifierId,
                operation_key: operationKey,
                intent_expires_at: intentExpiresAt,
                next_action: {
                    type: "start_new_private_setup",
                    tool: "solver_start_verifier_connection",
                    detail: "This protected-entry handoff expired. Start a new intent for the same verifier; do not reuse its continue_url or ask for the endpoint key.",
                },
            };
        }
        const path = `verifiers/${encodeURIComponent(verifierId)}/connection`;
        const before = await context.backend.request({ method: "GET", path, query: { operation_key: operationKey } });
        const pending = pendingForOperation(before, operationKey);
        if (!pending) {
            return {
                operation: "verifier_connection_continue",
                state: before.status === "unknown" || (before.last_operation && "status" in before.last_operation)
                    ? "unknown"
                    : "action_required",
                verifier_id: verifierId,
                operation_key: operationKey,
                connection: before,
                next_action: {
                    type: "inspect_or_complete_private_entry",
                    detail: "No key entered for this exact operation is ready to test. Complete its private page, then inspect the same operation_key; do not paste or re-enter a key in a tool call.",
                },
            };
        }
        let attempted = false;
        try {
            await context.backend.request({
                method: "POST",
                path: `${path}/test`,
                body: { ...pending, operation_key: operationKey },
                idempotencyKey,
            });
            attempted = true;
        }
        catch {
            // A missing acknowledgement proves nothing. The authenticated read below
            // is the only source for the operation's reported outcome.
        }
        const connection = await context.backend.request({ method: "GET", path, query: { operation_key: operationKey } });
        const last = recordedOperation(connection.last_operation);
        const committed = last?.kind === "promote" && last.phase === "committed";
        const failed = connection.last_test?.outcome === "failed" && connection.last_test.handle === pending.handle;
        const stillPending = connection.pending_key?.handle === pending.handle;
        const state = committed || (connection.status === "active" && connection.handle === pending.handle)
            ? "done"
            : failed ? "test_failed" : stillPending || !attempted ? "unknown" : "changed";
        return {
            operation: "verifier_connection_continue",
            state,
            verifier_id: verifierId,
            operation_key: operationKey,
            connection,
            ...(state === "unknown" ? {
                next_action: {
                    type: "resume_same_operation",
                    detail: "Inspect and continue this same operation_key. Do not start another setup or re-enter the key while the outcome is unknown.",
                },
            } : {}),
        };
    },
};
export const disconnectVerifierConnectionTool = {
    name: "solver_disconnect_verifier_connection",
    description: "Stop Millwork using the protected key for one output check (POST /v1/verifiers/{verifier_id}/connection/revoke). " +
        "Requires separate host confirmation and confirm_disconnect=true before this tool call. It does not revoke the key at the endpoint. " +
        "Reuse operation_key to inspect an unknown outcome and idempotency_key only for this exact request.",
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["verifier_id", "operation_key", "idempotency_key", "confirm_disconnect"],
        properties: {
            verifier_id: { type: "string", minLength: 1 },
            operation_key: { type: "string", minLength: 1, maxLength: 256 },
            idempotency_key: { type: "string", minLength: 1 },
            confirm_disconnect: {
                type: "boolean",
                const: true,
                description: "Set true only after the host has obtained separate confirmation to stop Millwork using this verifier key.",
            },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_disconnect_verifier_connection", disconnectVerifierConnectionTool.inputSchema, args);
        if (args.confirm_disconnect !== true) {
            throw new ToolInputError("solver_disconnect_verifier_connection: separate host confirmation is required before disconnecting.");
        }
        const verifierId = nonEmptyToolString("solver_disconnect_verifier_connection", "verifier_id", args.verifier_id);
        const operationKey = nonEmptyToolString("solver_disconnect_verifier_connection", "operation_key", args.operation_key);
        const idempotencyKey = nonEmptyToolString("solver_disconnect_verifier_connection", "idempotency_key", args.idempotency_key);
        const path = `verifiers/${encodeURIComponent(verifierId)}/connection`;
        try {
            await context.backend.request({
                method: "POST",
                path: `${path}/revoke`,
                body: { operation_key: operationKey },
                idempotencyKey,
            });
        }
        catch {
            // Reconcile the exact operation below. Retrying a different operation
            // could hide a committed disconnect or stop a newly restored key.
        }
        const connection = await context.backend.request({ method: "GET", path, query: { operation_key: operationKey } });
        const last = recordedOperation(connection.last_operation);
        const committed = last?.kind === "revoke" && last.phase === "committed";
        const done = connection.status === "revoked" || committed;
        return {
            operation: "verifier_connection_disconnect",
            state: done ? "done" : "unknown",
            verifier_id: verifierId,
            operation_key: operationKey,
            connection,
            endpoint_key_effect: "unchanged",
            ...(done ? {
                next_action: {
                    type: "remove_endpoint_key_separately",
                    detail: "Millwork stopped using the key. Remove or revoke it at the output-check endpoint through that endpoint's own authorized controls.",
                },
            } : {
                next_action: {
                    type: "inspect_same_operation",
                    detail: "Inspect this same operation_key before trying another access change.",
                },
            }),
        };
    },
};
export const testVerifierTool = {
    name: "solver_test_verifier",
    description: "Retest a registered output check (POST /v1/verifiers/{verifier_id}/test) and return four separate probe facts. " +
        "Requires verifier_id and a caller-owned idempotency_key. Does not accept secrets or start a model run. " +
        "A failed contract is never reported as ready.",
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
    },
    inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["verifier_id", "idempotency_key"],
        properties: {
            verifier_id: { type: "string", minLength: 1 },
            idempotency_key: { type: "string", minLength: 1 },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_test_verifier", testVerifierTool.inputSchema, args);
        const idempotencyKey = String(args.idempotency_key);
        if (!idempotencyKey.trim()) {
            throw new ToolInputError('solver_test_verifier: "idempotency_key" must be a non-empty caller-owned value.');
        }
        const report = await context.backend.request({
            method: "POST",
            path: `verifiers/${encodeURIComponent(String(args.verifier_id))}/test`,
            idempotencyKey,
        });
        return projectConnection({
            operation: "verifier_test",
            verifier_id: report.verifier_id,
            status: report.status,
            probe: report.probe,
            correctness_declaration: report.correctness_declaration,
        });
    },
};
