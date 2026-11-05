import { withCheckPresentation } from "../recordedCheckPresentation.js";
import { settleRunAdmissionFromReceipt } from "../executionAdmission.js";
import { assertRequiredPresent } from "../toolDefinition.js";
/**
 * `solver_receipt` -> `GET /v1/receipts/{execution_id}`.
 */
export const receiptTool = {
    name: "solver_receipt",
    description: "Read a run's outcome, selected model route, checks, and usage record " +
        "(GET /v1/receipts/{execution_id}). The receipt reports model usage in totals.usd and the platform fee " +
        "after any refund in totals.platform_fee_usd. Inventory receipts preserve unknown paid outcomes and unresolved provider exposure separately; known zero totals do not prove zero final cost. " +
        "Match it to the submitted run; failed runs can also have receipts. " +
        "This record is content-free and never returns the model's answer; use solver_result for that.",
    inputSchema: {
        type: "object",
        required: ["execution_id"],
        properties: { execution_id: { type: "string" } },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_receipt", receiptTool.inputSchema, args);
        const executionId = String(args.execution_id);
        const outcome = await context.backend.request({
            method: "GET",
            path: `receipts/${encodeURIComponent(executionId)}`,
        });
        await settleRunAdmissionFromReceipt({ executionId, receipt: outcome });
        return withCheckPresentation(outcome);
    },
};
