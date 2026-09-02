/**
 * Wire types for the objects this MCP server touches. These mirror the S1
 * SDK's `packages/sdk-ts/src/types.ts` exactly (same snake_case wire casing,
 * same enum values) rather than importing that package: S1's build output
 * (`dist/`) is gitignored, so a `file:` dependency on `@millwork/solver` would
 * not resolve for an isolated `npm install && npm run build` of this package
 * before a monorepo/workspace layout lands (punchlist row S4). Keeping a
 * small, self-contained copy is the minimal-deps choice; the enum values are
 * the load-bearing part and are kept identical to S1 so both surfaces reject
 * exactly what the live backend rejects.
 */
export type ArmKind = "model" | "agent" | "skill";
export type ArmStatus = "ready" | "degraded" | "disabled";
export type CostClass = "economy" | "standard" | "premium";
export type DataClass = "public" | "sandbox" | "tenant_internal";
export interface ArmEndpoint {
    url: string;
    auth_ref: string;
}
export interface ArmLifecycle {
    long_running?: boolean;
    cancellable?: boolean;
    max_runtime_s?: number;
}
export interface ArmArtifact {
    content: string;
    version: string;
    editable_regions: string[];
}
/** Full arm record as returned by GET /v1/arms/{armId} and GET /v1/arms. */
export interface Arm {
    arm_id: string;
    kind: ArmKind;
    display_name: string;
    status: ArmStatus;
    capability_tags: string[];
    data_class_grants: DataClass[];
    cost_class?: CostClass;
    provider?: string;
    model_id?: string;
    endpoint?: ArmEndpoint;
    lifecycle?: ArmLifecycle;
    artifact_hash?: string;
    [extra: string]: unknown;
}
/** Body for POST /v1/arms -- one namespace per kind's required fields. */
export interface ArmWrite {
    kind: ArmKind;
    display_name: string;
    capability_tags: string[];
    data_class_grants: DataClass[];
    cost_class?: CostClass;
    provider?: string;
    model_id?: string;
    credential_ref?: string;
    endpoint?: ArmEndpoint;
    lifecycle?: ArmLifecycle;
    artifact?: ArmArtifact;
}
export interface ArmListFilter {
    kind?: ArmKind;
    status?: ArmStatus;
    cursor?: string;
    limit?: number;
}
/**
 * docs/PRODUCT_CONTRACT.md's live lifecycle states (Sec4).
 */
export type LifecycleState = "accepted" | "queued" | "running" | "progress" | "completed" | "failed" | "cancelled" | "expired";
export interface Execution {
    execution_id: string;
    status: LifecycleState;
    [extra: string]: unknown;
}
