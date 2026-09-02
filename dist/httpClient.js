import { SolverApiError, SolverApiNetworkError } from "./errors.js";
function buildUrl(baseUrl, path, query) {
    const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined)
                url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}
function isRetryableStatus(status) {
    return status >= 500;
}
/**
 * Decide the retry boundary before the first attempt. Mutations do not become
 * replay-safe because a client configured retries globally: only a non-empty
 * key supplied on this request moves them into the same-key boundary.
 */
export function classifyRequestRetryBoundary(request) {
    if (request.method === "GET" || request.method === "HEAD")
        return "safe_read";
    if (request.idempotencyKey?.trim())
        return "same_key_mutation";
    return "single_attempt_mutation";
}
export class SolverBackendClient {
    apiKey;
    baseUrl;
    maxRetries;
    retryBackoffMs;
    fetchImpl;
    constructor(opts) {
        this.apiKey = opts.apiKey;
        this.baseUrl = opts.baseUrl;
        this.maxRetries = opts.maxRetries ?? 2;
        this.retryBackoffMs = opts.retryBackoffMs ?? 500;
        this.fetchImpl = opts.fetchImpl ?? fetch;
    }
    async request(opts) {
        const url = buildUrl(this.baseUrl, opts.path, opts.query);
        const retryBoundary = classifyRequestRetryBoundary(opts);
        const canRetry = retryBoundary !== "single_attempt_mutation";
        // Freeze the bytes once. A caller mutating the input object while a retry
        // is delayed must not turn the next same-key attempt into a different
        // request body.
        const serializedBody = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
        const headers = {
            authorization: `Bearer ${this.apiKey}`,
            accept: "application/json",
        };
        if (opts.body !== undefined)
            headers["content-type"] = "application/json";
        if (opts.idempotencyKey !== undefined)
            headers["idempotency-key"] = opts.idempotencyKey;
        const frozenHeaders = Object.freeze({ ...headers });
        let attempt = 0;
        for (;;) {
            let response;
            try {
                response = await this.fetchImpl(url, {
                    method: opts.method,
                    // Give an injected fetch its own copy without letting it mutate the
                    // frozen key/header snapshot used by a later attempt.
                    headers: { ...frozenHeaders },
                    body: serializedBody,
                });
            }
            catch (cause) {
                if (canRetry && attempt < this.maxRetries) {
                    await this.delay(attempt);
                    attempt += 1;
                    continue;
                }
                throw new SolverApiNetworkError(`Request to ${opts.method} ${opts.path} failed after ${attempt + 1} attempt(s): network error.`, cause);
            }
            if (response.ok) {
                if (response.status === 204 || opts.method === "HEAD")
                    return undefined;
                return (await response.json());
            }
            if (canRetry && isRetryableStatus(response.status) && attempt < this.maxRetries) {
                await this.delay(attempt);
                attempt += 1;
                continue;
            }
            throw await this.toApiError(response);
        }
    }
    delay(attempt) {
        const backoff = this.retryBackoffMs * 2 ** attempt;
        return new Promise((resolve) => setTimeout(resolve, backoff));
    }
    async toApiError(response) {
        let body;
        try {
            body = (await response.json());
        }
        catch (cause) {
            return new SolverApiNetworkError(`Received ${response.status} with a body that could not be parsed as a Problem response.`, cause);
        }
        return new SolverApiError(body);
    }
}
//# sourceMappingURL=httpClient.js.map