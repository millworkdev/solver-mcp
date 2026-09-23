import { type RunRequestPreview } from "#solver-run-admission";
import type { SolverBackendClient } from "./httpClient.js";
import type { Execution, ExecutionRequest } from "./types.js";
interface AccountProjection {
    tenant_id?: unknown;
    billing?: {
        platform_fee_usd_per_execution?: unknown;
    } | null;
}
interface ModelCatalog {
    models?: unknown;
}
interface SelectedArm {
    arm_id?: unknown;
    model_deployment_id?: unknown;
}
export declare class RunAdmissionActionRequired extends Error {
    readonly document: Record<string, unknown>;
    constructor(document: Record<string, unknown>);
}
export declare function deriveRunAdmissionFacts(input: {
    account: AccountProjection;
    arm: SelectedArm;
    catalog: ModelCatalog;
    request: ExecutionRequest;
}): {
    preview: RunRequestPreview;
    costReview: Record<string, unknown>;
};
export declare function submitWithRunAdmission(input: {
    backend: SolverBackendClient;
    request: ExecutionRequest;
    replayKey: string;
}): Promise<Execution>;
export declare function settleRunAdmissionFromReceipt(input: {
    executionId: string;
    chargedUsd: number;
    receipt: unknown;
}): Promise<void>;
export {};
