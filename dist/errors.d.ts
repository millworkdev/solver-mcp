/**
 * RFC-7807 Problem handling, mirrored from the TypeScript SDK's
 * errors module. The MCP tool surface must relay the
 * backend's Problem body as *structured* error data (the server documentation's
 * "surfaced as a tool error with the Problem body as structured error data,
 * not a flattened string"), so we keep the parsed fields rather than
 * collapsing them into a message.
 */
export interface FieldError {
    field: string;
    message: string;
}
export interface ProblemBody {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance: string;
    errors?: FieldError[];
    retry_after_s?: number;
}
/**
 * Thrown for every non-2xx backend response. Carries the parsed Problem body
 * verbatim so a tool handler can attach it to the MCP error result unchanged.
 */
export declare class SolverApiError extends Error {
    readonly problem: ProblemBody;
    readonly type: string;
    readonly status: number;
    readonly detail?: string;
    readonly instance: string;
    readonly errors?: FieldError[];
    readonly retryAfterS?: number;
    constructor(problem: ProblemBody);
}
/**
 * Thrown when a response could not be parsed as a Problem body at all (a
 * network failure that produced no body, or a non-conformant server
 * response) -- kept distinct from SolverApiError so a caller can tell "the
 * server told me it failed" apart from "something below HTTP broke".
 */
export declare class SolverApiNetworkError extends Error {
    readonly cause?: unknown;
    constructor(message: string, cause?: unknown);
}
