/**
 * MCP check_presentation copy for recorded_check facts.
 * Meanings follow the approved recorded-state matrix. This module labels;
 * it does not invent a recorded state from absence.
 */
export declare const BASELINE_CHECK_LABEL = "No customer check selected: output-presence check only.";
export declare const PLATFORM_TEST_LABEL = "Platform test";
/** Noninteractive public connect. Agents cannot supply TTY prompts. */
export declare const PUBLIC_VERIFIER_CONNECT_COMMAND = "millwork verifier connect --endpoint <https-url> --access public --name <name> --version <version> --connect-only --json";
export interface CheckPresentation {
    state: string;
    label: string;
}
/** Prefer a top-level recorded_check, then the first slice that carries one. */
export declare function recordedCheckFromPayload(payload: unknown): unknown;
export declare function presentRecordedCheck(recorded: unknown): CheckPresentation | undefined;
/**
 * Attach check_presentation when a recorded_check fact exists. Absence is
 * not pending, baseline, or unavailable. baselineSelected covers a submit
 * that omitted verifier_id before any recorded_check event exists.
 */
export declare function withCheckPresentation(payload: unknown, options?: {
    baselineSelected?: boolean;
    platformTestSelected?: boolean;
}): unknown;
/**
 * Status and result routes do not serialize recorded_check. Overlay from the
 * receipt when that fact exists. A missing or failed receipt read must not
 * invent a state or fail the original tool.
 */
export declare function withCheckPresentationFromReceipt(payload: unknown, loadReceipt: () => Promise<unknown>): Promise<unknown>;
export declare const BASELINE_REFUSAL_MESSAGE: string;
