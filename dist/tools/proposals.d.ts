import { type ToolDefinition } from "../toolDefinition.js";
/**
 * The two live proposal tools.
 */
/**
 * `solver_proposals` -> `GET /v1/proposals` (list) or `GET /v1/proposals/{id}`
 * (one, when `proposal_id` is set). Content-free: returns IDs, statuses,
 * scores and the editable-region diff, never task output.
 */
export declare const proposalsTool: ToolDefinition;
/**
 * `solver_review_proposal` -> `POST /v1/proposals/{id}/approve` or
 * `.../reject`, selected by the `decision` parameter. docs/MCP_SERVER.md
 * folds both actions into one tool deliberately: the underlying contract
 * requires a reject path, so an approve-only surface would be a real gap.
 */
export declare const reviewProposalTool: ToolDefinition;
