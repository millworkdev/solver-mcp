import { assertRequiredPresent } from "../toolDefinition.js";
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
    description: "List the model sources this tenant can connect (GET /v1/model-source-profiles). " +
        "Every source runs on your provider key/account by construction: each entry carries " +
        "its protocol/auth profile versions and endpoint policy. No credential material is involved.",
    inputSchema: { type: "object", properties: {} },
    async handler(_args, context) {
        return context.backend.request({ method: "GET", path: "model-source-profiles" });
    },
};
/** `solver_start_source_handoff` -> `POST /v1/source-credential-handoffs`. */
export const startSourceHandoffTool = {
    name: "solver_start_source_handoff",
    description: "Start a hosted browser credential handoff for a source (POST /v1/source-credential-handoffs). " +
        "Returns a continue_url for a HUMAN to complete in a browser against the credential broker -- " +
        "this tool never accepts or returns a raw key, service-account JSON, cloud secret, or token. " +
        "Poll with solver_poll_source_handoff until state=completed, then pass the handoff_intent_id " +
        "to solver_create_source_connection.",
    inputSchema: {
        type: "object",
        required: ["source_id", "auth_scheme"],
        additionalProperties: false,
        properties: {
            source_id: { type: "string" },
            auth_scheme: { type: "string", enum: ["api_key", "oauth2", "aws_sts_sigv4"] },
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
    description: "Poll a credential handoff intent until the human completes it in the browser " +
        "(GET /v1/source-credential-handoffs/{handoff_intent_id}). Answers the intent state only.",
    inputSchema: {
        type: "object",
        required: ["handoff_intent_id"],
        properties: { handoff_intent_id: { type: "string" } },
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
    description: "Bind a source connection for your provider key/account from a COMPLETED handoff intent (POST /v1/source-connections). " +
        "Takes only the opaque handoff_intent_id -- never credential material. A fresh connection is " +
        "disabled until solver_test_source_connection passes; deployments then come from " +
        "solver_sync_source_deployments.",
    inputSchema: {
        type: "object",
        required: ["display_name", "source_id", "auth_scheme", "handoff_intent_id", "source_scope"],
        additionalProperties: false,
        properties: {
            display_name: { type: "string" },
            source_id: { type: "string" },
            auth_scheme: { type: "string", enum: ["api_key", "oauth2", "aws_sts_sigv4"] },
            handoff_intent_id: { type: "string" },
            source_scope: {
                type: "object",
                description: "Exactly one of {kind:'account',account_ref} | {kind:'project',project_ref} | {kind:'region',region}.",
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
    description: "Run the live credential test on a source connection (POST /v1/source-connections/{id}/test). " +
        "A passing test activates the connection; the wire reports test_state/test_error.",
    inputSchema: {
        type: "object",
        required: ["connection_id"],
        properties: { connection_id: { type: "string" } },
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
    description: "List this tenant's source connections with their test/rotation state " +
        "(GET /v1/source-connections). auth_binding_ref is an opaque broker handle, never a secret.",
    inputSchema: { type: "object", properties: {} },
    async handler(_args, context) {
        return context.backend.request({ method: "GET", path: "source-connections" });
    },
};
/** `solver_sync_source_deployments` -> `POST /v1/source-connections/{id}/deployments/sync`. */
export const syncSourceDeploymentsTool = {
    name: "solver_sync_source_deployments",
    description: "Discover and persist the connection-authorized, certification-backed deployments " +
        "(POST /v1/source-connections/{id}/deployments/sync). Requires an ACTIVE (tested) connection; " +
        "answers the synced deployment set. Discovery is not certification: unevidenced identities " +
        "are never persisted.",
    inputSchema: {
        type: "object",
        required: ["connection_id"],
        properties: { connection_id: { type: "string" } },
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
    description: "List the tenant's certification-backed model deployments (GET /v1/model-deployments). " +
        "Enable one as an arm with solver_enable_model_arm.",
    inputSchema: { type: "object", properties: {} },
    async handler(_args, context) {
        return context.backend.request({ method: "GET", path: "model-deployments" });
    },
};
