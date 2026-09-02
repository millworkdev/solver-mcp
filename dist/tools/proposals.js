import { assertRequiredPresent, ToolInputError } from "../toolDefinition.js";
/**
 * The two live proposal tools.
 */
/**
 * `solver_proposals` -> `GET /v1/proposals` (list) or `GET /v1/proposals/{id}`
 * (one, when `proposal_id` is set). Content-free: returns IDs, statuses,
 * scores and the editable-region diff, never task output.
 */
export const proposalsTool = {
    name: "solver_proposals",
    description: "List pending repair proposals, or inspect one when proposal_id is set " +
        "(GET /v1/proposals[/{id}]).",
    inputSchema: {
        type: "object",
        properties: {
            proposal_id: {
                type: "string",
                description: "If set, returns one Proposal with its diff + verifier_evidence. If omitted, lists.",
            },
            status: { enum: ["pending", "approved", "rejected", "expired"] },
            arm_id: { type: "string" },
        },
    },
    async handler(args, context) {
        if (args.proposal_id !== undefined) {
            return context.backend.request({
                method: "GET",
                path: `proposals/${encodeURIComponent(String(args.proposal_id))}`,
            });
        }
        return context.backend.request({
            method: "GET",
            path: "proposals",
            query: {
                status: args.status,
                arm_id: args.arm_id,
            },
        });
    },
};
/**
 * `solver_review_proposal` -> `POST /v1/proposals/{id}/approve` or
 * `.../reject`, selected by the `decision` parameter. docs/MCP_SERVER.md
 * folds both actions into one tool deliberately: the underlying contract
 * requires a reject path, so an approve-only surface would be a real gap.
 */
export const reviewProposalTool = {
    name: "solver_review_proposal",
    description: "Approve or reject a repair proposal (POST /v1/proposals/{id}/approve|reject); " +
        "the decision parameter selects which.",
    inputSchema: {
        type: "object",
        required: ["proposal_id", "decision"],
        properties: {
            proposal_id: { type: "string" },
            decision: { enum: ["approve", "reject"] },
            reason: { type: "string", description: "Optional, reject only." },
        },
    },
    async handler(args, context) {
        assertRequiredPresent("solver_review_proposal", reviewProposalTool.inputSchema, args);
        const decision = String(args.decision);
        if (decision !== "approve" && decision !== "reject") {
            throw new ToolInputError('solver_review_proposal: "decision" must be approve or reject.');
        }
        const proposalId = encodeURIComponent(String(args.proposal_id));
        return context.backend.request({
            method: "POST",
            path: `proposals/${proposalId}/${decision}`,
            body: decision === "reject" && args.reason !== undefined ? { reason: args.reason } : undefined,
        });
    },
};
//# sourceMappingURL=proposals.js.map