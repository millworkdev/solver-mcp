import { type ToolDefinition } from "../toolDefinition.js";
/**
 * `solver_register_arm` -> `POST /v1/arms`. The properties enumerate the Arm
 * write-shape (the product contract §2.1); required at the top level are
 * the kind-agnostic fields, matching the server documentation's register schema.
 * The backend does the full per-kind validation (e.g. model needs
 * provider/model_id, skill needs artifact) and returns a structured 400 when
 * a kind's own requirements are unmet, which the dispatcher relays.
 */
export declare const registerArmTool: ToolDefinition;
/**
 * `solver_list_arms` -> `GET /v1/arms`. Returns `{ arms, next_cursor }`
 * exactly as the backend does -- cursor pagination is surfaced verbatim so an
 * MCP client drives it the same way a direct caller does (no auto-fetch of
 * further pages, matching the SDK's Paginated contract).
 */
export declare const listArmsTool: ToolDefinition;
/**
 * `solver_enable_model_arm` -> `POST /v1/arms` with `kind: "model"` pinned.
 * The deployment-bound registration path: claims wider than the deployment's
 * certified template are rejected server-side, and no credential material is
 * involved -- the deployment already carries the connection binding.
 */
export declare const enableModelArmTool: ToolDefinition;
