import { assertRequiredPresent } from "../toolDefinition.js";
/**
 * `solver_receipt` -> `GET /v1/receipts/{execution_id}`.
 */
export const receiptTool = {
    name: "solver_receipt",
    description: "Fetch the receipt for an execution -- route rationale, per-slice evals, cost " +
        "(GET /v1/receipts/{execution_id}). Content-free: never returns task output.",
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
//# sourceMappingURL=receipts.js.map