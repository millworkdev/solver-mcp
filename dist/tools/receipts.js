import { assertRequiredPresent } from "../toolDefinition.js";
/**
 * `solver_receipt` -> `GET /v1/receipts/{execution_id}`.
 */
export const receiptTool = {
    name: "solver_receipt",
    description: "Read a run's outcome, selected model route, checks, and usage record " +
        "(GET /v1/receipts/{execution_id}). Match it to the submitted run; failed runs can also have receipts. " +
        "This record is content-free and never returns the model's answer; use solver_result for that.",
    inputSchema: {
        type: "object",
        required: ["execution_id"],
        properties: { execution_id: { type: "string" } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_receipt", receiptTool.inputSchema, args);
        return context.backend.request({
            method: "GET",
            path: `receipts/${encodeURIComponent(String(args.execution_id))}`,
        });
    },
};
