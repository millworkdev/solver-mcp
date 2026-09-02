/**
 * Thin fetch-based HTTP client, mirrored from the S1 SDK's
 * `packages/sdk-ts/src/httpClient.ts`. It holds the tenant's API key once
 * (docs/MCP_SERVER.md: "the MCP server authenticates once... every tool call
 * inherits that tenant scope"), adds the auth header, JSON-encodes/decodes,
 * retries network errors and 5xx only when the request is a safe read or a
 * mutation carrying a caller-owned, non-empty idempotency key (never a 4xx),
 * and throws a typed SolverApiError on any non-2xx. No
 * ranking/policy/caching behavior lives here -- the MCP tools are thin
 * wrappers, same rule as the SDK.
 */
export interface SolverBackendOptions {
    apiKey: string;
    baseUrl: string;
    /** Network/5xx retries only -- a 4xx is never retried. Default 2. */
    maxRetries?: number;
    /** Base of the exponential backoff (ms). Default 500. */
    retryBackoffMs?: number;
    /** Injectable for tests; defaults to the global fetch. */
    fetchImpl?: typeof fetch;
}
export interface RequestOptions {
    method: "GET" | "HEAD" | "POST" | "PATCH" | "DELETE";
    path: string;
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    idempotencyKey?: string;
}
export type RequestRetryBoundary = "safe_read" | "same_key_mutation" | "single_attempt_mutation";
/**
 * Decide the retry boundary before the first attempt. Mutations do not become
 * replay-safe because a client configured retries globally: only a non-empty
 * key supplied on this request moves them into the same-key boundary.
 */
export declare function classifyRequestRetryBoundary(request: Pick<RequestOptions, "method" | "idempotencyKey">): RequestRetryBoundary;
export declare class SolverBackendClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly maxRetries;
    private readonly retryBackoffMs;
    private readonly fetchImpl;
    constructor(opts: SolverBackendOptions);
    request<T>(opts: RequestOptions): Promise<T>;
    private delay;
    private toApiError;
}
