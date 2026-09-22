import type { SolverBackendClient } from "./httpClient.js";
import type { Execution, ExecutionRequest } from "./types.js";
export declare class RunAdmissionActionRequired extends Error {
    readonly document: Record<string, unknown>;
    constructor(document: Record<string, unknown>);
}
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
