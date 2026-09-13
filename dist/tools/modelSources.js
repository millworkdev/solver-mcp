import { assertRequiredPresent, ToolInputError } from "../toolDefinition.js";
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
export const listSourcesTool = {
    name: "solver_list_sources",
    description: "List the providers your organization can connect and the setup methods each supports " +
        "(GET /v1/model-source-profiles). Call this before asking the user to choose a provider; " +
        "the Millwork organization API key is separate from the provider credential entered later in the browser.",
    inputSchema: { type: "object", properties: {} },
    async handler(_args, context) {
        return context.backend.request({ method: "GET", path: "model-source-profiles" });
    },
};
/** `solver_start_source_handoff` -> `POST /v1/source-credential-handoffs`. */
export const startSourceHandoffTool = {
    name: "solver_start_source_handoff",
    description: "Start setup for the selected provider account (POST /v1/source-credential-handoffs). " +
        "Give the returned private continue_url to the user to open in their regular browser, where they complete approval or key entry. " +
        "Never ask for a provider credential in chat or a tool call. Browser completion is not the finish: poll this setup next. " +
        "For aws_bedrock, api_key is the normal setup method; aws_sts_sigv4 is a separate advanced choice, never a fallback.",
    inputSchema: {
        type: "object",
        required: ["source_id", "auth_scheme"],
        additionalProperties: false,
        properties: {
            source_id: { type: "string", description: "Provider ID returned by solver_list_sources. Use the provider the user chose." },
            auth_scheme: {
                type: "string",
                enum: ["api_key", "oauth2", "aws_sts_sigv4"],
                description: "A setup method offered for this provider. Follow its browser instructions; api_key does not mean paste a key into this tool.",
            },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_start_source_handoff", startSourceHandoffTool.inputSchema, args);
        return context.backend.request({
            method: "POST",
            path: "source-credential-handoffs",
            body: { source_id: args.source_id, auth_scheme: args.auth_scheme },
        });
    },
};
/** `solver_poll_source_handoff` -> `GET /v1/source-credential-handoffs/{id}`. */
export const pollSourceHandoffTool = {
    name: "solver_poll_source_handoff",
    description: "Check whether the provider's private browser setup is complete " +
        "(GET /v1/source-credential-handoffs/{handoff_intent_id}). When completed, use the returned setup details unchanged to save the provider connection.",
    inputSchema: {
        type: "object",
        required: ["handoff_intent_id"],
        properties: { handoff_intent_id: { type: "string", description: "ID returned when this browser setup was started." } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_poll_source_handoff", pollSourceHandoffTool.inputSchema, args);
        return context.backend.request({
            method: "GET",
            path: `source-credential-handoffs/${encodeURIComponent(String(args.handoff_intent_id))}`,
        });
    },
};
/** `solver_create_source_connection` -> `POST /v1/source-connections`. */
export const createSourceConnectionTool = {
    name: "solver_create_source_connection",
    description: "Save a provider connection from completed browser setup (POST /v1/source-connections). " +
        "Use the returned setup ID and scope unchanged; never send credential material. Test the connection before refreshing its available models.",
    inputSchema: {
        type: "object",
        required: ["display_name", "source_id", "auth_scheme", "handoff_intent_id", "source_scope"],
        additionalProperties: false,
        properties: {
            display_name: { type: "string", description: "A name the user will recognize for this provider connection." },
            source_id: { type: "string", description: "Provider ID returned by solver_list_sources." },
            auth_scheme: { type: "string", enum: ["api_key", "oauth2", "aws_sts_sigv4"] },
            handoff_intent_id: { type: "string", description: "ID of the completed browser setup used for this connection." },
            source_scope: {
                type: "object",
                description: "Use the account, project, or Region scope returned by completed browser setup unchanged. Do not ask the user to invent this value.",
            },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_create_source_connection", createSourceConnectionTool.inputSchema, args);
        return context.backend.request({ method: "POST", path: "source-connections", body: args });
    },
};
/** `solver_test_source_connection` -> `POST /v1/source-connections/{id}/test`. */
export const testSourceConnectionTool = {
    name: "solver_test_source_connection",
    description: "Check a saved connection's access to its provider (POST /v1/source-connections/{id}/test). " +
        "This check does not run the user's task. After it passes, refresh available models; on a reported error, stop and explain test_error.",
    inputSchema: {
        type: "object",
        required: ["connection_id"],
        properties: { connection_id: { type: "string", description: "The saved provider connection to test." } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_test_source_connection", testSourceConnectionTool.inputSchema, args);
        return context.backend.request({
            method: "POST",
            path: `source-connections/${encodeURIComponent(String(args.connection_id))}/test`,
        });
    },
};
/** `solver_list_source_connections` -> `GET /v1/source-connections`. */
export const listSourceConnectionsTool = {
    name: "solver_list_source_connections",
    description: "List the organization's saved provider connections and their access-check state " +
        "(GET /v1/source-connections). Returned credential references are identifiers, never provider secrets.",
    inputSchema: { type: "object", properties: {} },
    async handler(_args, context) {
        return context.backend.request({ method: "GET", path: "source-connections" });
    },
};
/** `solver_disconnect_source_connection` -> `DELETE /v1/source-connections/{id}`. */
export const disconnectSourceConnectionTool = {
    name: "solver_disconnect_source_connection",
    description: "Disconnect one saved provider connection after explicit human confirmation " +
        "(DELETE /v1/source-connections/{connection_id}). This immediately makes the " +
        "Millwork connection unusable and disables its dependent model deployments and arms. " +
        "Millwork schedules its stored credential binding for deletion; this does not revoke " +
        "or delete the credential in the provider account, cancel calls already sent, or refund usage. Before calling, explain which " +
        "connection will be disconnected. A same-key retry must preserve the exact request.",
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
    },
    inputSchema: {
        type: "object",
        required: ["connection_id", "idempotency_key"],
        additionalProperties: false,
        properties: {
            connection_id: {
                type: "string",
                minLength: 1,
                description: "The exact saved Millwork provider connection to disconnect.",
            },
            idempotency_key: {
                type: "string",
                minLength: 1,
                description: "Caller-owned Idempotency-Key. Reuse it only for the same connection and the same disconnect intent.",
            },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_disconnect_source_connection", disconnectSourceConnectionTool.inputSchema, args);
        const connectionId = String(args.connection_id);
        const idempotencyKey = String(args.idempotency_key);
        if (connectionId.trim() === "" || idempotencyKey.trim() === "") {
            throw new ToolInputError("solver_disconnect_source_connection: connection_id and idempotency_key must be non-empty.");
        }
        return context.backend.request({
            method: "DELETE",
            path: `source-connections/${encodeURIComponent(connectionId)}`,
            idempotencyKey,
        });
    },
};
/** `solver_sync_source_deployments` -> `POST /v1/source-connections/{id}/deployments/sync`. */
export const syncSourceDeploymentsTool = {
    name: "solver_sync_source_deployments",
    description: "Refresh the supported catalog models that the tested provider connection can access " +
        "(POST /v1/source-connections/{id}/deployments/sync). A returned model is both supported by Millwork and available to this provider account; empty or failed discovery is not permission to guess a model.",
    inputSchema: {
        type: "object",
        required: ["connection_id"],
        properties: { connection_id: { type: "string", description: "The tested provider connection whose available models should be refreshed." } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_sync_source_deployments", syncSourceDeploymentsTool.inputSchema, args);
        return context.backend.request({
            method: "POST",
            path: `source-connections/${encodeURIComponent(String(args.connection_id))}/deployments/sync`,
            body: {},
        });
    },
};
/** `solver_list_model_deployments` -> `GET /v1/model-deployments`. */
export const listModelDeploymentsTool = {
    name: "solver_list_model_deployments",
    description: "List supported catalog models and their provider connections (GET /v1/model-deployments). " +
        "Choose only a catalog entry whose connection_id matches the provider connection just tested; then let the user choose the exact model and save it with solver_enable_model_arm.",
    inputSchema: { type: "object", properties: {} },
    async handler(_args, context) {
        return context.backend.request({ method: "GET", path: "model-deployments" });
    },
};
