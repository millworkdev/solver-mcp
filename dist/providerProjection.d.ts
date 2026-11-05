import type { ProviderProfileView, ProviderWorkspaceView } from "../dist/provider-sdk/provider/index.js";
export declare const PROVIDER_MCP_ROUTE_ID_SCHEMA: {
    type: string;
    maxLength: number;
    pattern: string;
    description: string;
};
export declare const PROVIDER_MCP_PROFILE_SCHEMA: {
    type: "object";
    additionalProperties: boolean;
    required: string[];
    properties: Record<string, object>;
};
export declare const PROVIDER_MCP_WORKSPACE_SCHEMA: {
    type: "object";
    additionalProperties: boolean;
    required: string[];
    properties: Record<string, object>;
};
export declare const PROVIDER_MCP_VALIDATION_SCHEMA: {
    type: "object";
    additionalProperties: boolean;
    required: string[];
    properties: Record<string, object>;
};
export declare const PROVIDER_MCP_ONLINE_CHECK_SCHEMA: {
    type: "object";
    additionalProperties: boolean;
    required: string[];
    properties: Record<string, object>;
};
export declare function providerProfileStatus(view: ProviderProfileView): {
    tenant_id: string;
    profile_revision: number;
    feed_etag: string;
    status: import("../dist/provider-sdk/provider/index.js").ProviderApplicationStatus;
    listed: false;
    listing_scope: "customer_exposure";
    next_actor: "provider" | "operator" | "none";
    routes: {
        route_id: string;
        route_id_trust: string;
        revision_id: string;
        state: import("../dist/provider-sdk/provider/index.js").ProviderRouteState;
        approval_state: import("../dist/provider-sdk/provider/index.js").ProviderRouteState;
        activation_scope: "loaded_manifest" | null;
        exposure: {
            catalog: "hidden" | "canary_only" | "visible" | "unobserved";
            execution: "unobserved" | "closed" | "admission_open";
            degraded: boolean;
            label: "In manifest" | "Catalog visible" | "Canary only" | "Admission open" | "Exposure unobserved";
        } | null;
        suspension: {
            by: "operator" | "system";
            reason: "operator_suspended" | import("../dist/provider-sdk/provider/index.js").ProviderRouteLifecycleReason;
        } | null;
    }[];
};
export declare function providerWorkspaceStatus(view: ProviderWorkspaceView): {
    tenant_id: string;
    feed_etag: string;
    listed: false;
    machine_access: {
        enabled: boolean;
    };
    organization: {
        profile_revision: number;
        status: import("../dist/provider-sdk/provider/index.js").ProviderApplicationStatus;
    };
    terms: {
        current: boolean;
        accepted_at: string;
        can_accept: boolean;
    };
    domain: {
        current: boolean;
        verified_at: string | null;
        valid_until: string | null;
    };
    next: {
        actor: "provider" | "operator" | "none";
    };
    routes: {
        revision: number;
        created_at: string;
        t2_valid_until: string | null;
        expired: boolean;
        probe: {
            status: "active" | "expired" | "revoked" | "none" | "closed";
            expires_at: string | null;
        };
        next: {
            actor: "provider" | "operator" | "none";
        };
        route_id: string;
        route_id_trust: string;
        revision_id: string;
        state: import("../dist/provider-sdk/provider/index.js").ProviderRouteState;
        approval_state: import("../dist/provider-sdk/provider/index.js").ProviderRouteState;
        activation_scope: "loaded_manifest" | null;
        exposure: {
            catalog: "hidden" | "canary_only" | "visible" | "unobserved";
            execution: "unobserved" | "closed" | "admission_open";
            degraded: boolean;
            label: "In manifest" | "Catalog visible" | "Canary only" | "Admission open" | "Exposure unobserved";
        } | null;
        suspension: {
            by: "operator" | "system";
            reason: "operator_suspended" | import("../dist/provider-sdk/provider/index.js").ProviderRouteLifecycleReason;
        } | null;
    }[];
    latest_feed: {
        snapshot_id: string;
        created_at: string;
        validation: {
            result: "validated" | "nonconformant";
            counts: {
                error: number;
                warning: number;
            };
        };
    } | null;
};
