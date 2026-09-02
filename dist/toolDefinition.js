/**
 * Thrown when a call is missing a parameter the tool's own inputSchema marks
 * required. This is a first-line guard so a structurally-invalid call (e.g.
 * solver_submit without idempotency_key) fails locally with a clear message
 * instead of being forwarded to the backend -- the backend still does full
 * per-field validation, this only enforces top-level `required` presence.
 */
export class ToolInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "ToolInputError";
    }
}
/**
 * Enforce a schema's top-level `required` array against the given arguments.
 * Only presence is checked here; type/enum/nested validation is the
 * backend's job (and is relayed as a structured 400 Problem when it fails).
 */
export function assertRequiredPresent(toolName, schema, args) {
    for (const field of schema.required ?? []) {
        if (args[field] === undefined || args[field] === null) {
            throw new ToolInputError(`${toolName}: missing required parameter "${field}".`);
        }
    }
}
