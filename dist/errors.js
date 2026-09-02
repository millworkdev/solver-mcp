/**
 * Thrown for every non-2xx backend response. Carries the parsed Problem body
 * verbatim so a tool handler can attach it to the MCP error result unchanged.
 */
export class SolverApiError extends Error {
    problem;
    type;
    status;
    detail;
    instance;
    errors;
    retryAfterS;
    constructor(problem) {
        super(problem.title);
        this.name = "SolverApiError";
        this.problem = problem;
        this.type = problem.type;
        this.status = problem.status;
        this.detail = problem.detail;
        this.instance = problem.instance;
        this.errors = problem.errors;
        this.retryAfterS = problem.retry_after_s;
    }
}
/**
 * Thrown when a response could not be parsed as a Problem body at all (a
 * network failure that produced no body, or a non-conformant server
 * response) -- kept distinct from SolverApiError so a caller can tell "the
 * server told me it failed" apart from "something below HTTP broke".
 */
export class SolverApiNetworkError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.name = "SolverApiNetworkError";
        this.cause = cause;
    }
}
