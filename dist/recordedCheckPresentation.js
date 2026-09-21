/**
 * MCP check_presentation copy for recorded_check facts.
 * Meanings follow the approved recorded-state matrix. This module labels;
 * it does not invent a recorded state from absence.
 */
export const BASELINE_CHECK_LABEL = "No customer check selected: output-presence check only.";
export const PLATFORM_TEST_LABEL = "Platform test";
/** Noninteractive public connect. Agents cannot supply TTY prompts. */
export const PUBLIC_VERIFIER_CONNECT_COMMAND = "millwork verifier connect --endpoint <https-url> --access public --name <name> --version <version> --connect-only --json";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Prefer a top-level recorded_check, then the first slice that carries one. */
export function recordedCheckFromPayload(payload) {
    if (!isRecord(payload))
        return undefined;
    if (payload.recorded_check !== undefined)
        return payload.recorded_check;
    if (!Array.isArray(payload.slices))
        return undefined;
    for (const slice of payload.slices) {
        if (isRecord(slice) && slice.recorded_check !== undefined)
            return slice.recorded_check;
    }
    return undefined;
}
export function presentRecordedCheck(recorded) {
    if (!isRecord(recorded) || typeof recorded.state !== "string")
        return undefined;
    switch (recorded.state) {
        case "customer_verdict":
            if (recorded.is_correct === true) {
                return { state: "customer_verdict", label: "Your check accepted this output" };
            }
            if (recorded.is_correct === false) {
                return { state: "customer_verdict", label: "Your check rejected this output" };
            }
            return undefined;
        case "customer_unavailable":
            return { state: "customer_unavailable", label: "This output could not be checked" };
        case "baseline":
            return { state: "baseline", label: BASELINE_CHECK_LABEL };
        case "platform_test":
            return { state: "platform_test", label: PLATFORM_TEST_LABEL };
        case "pending_evaluation":
            return { state: "pending_evaluation", label: "Evaluation was pending when recorded" };
        case "terminal_no_evaluation":
            return { state: "terminal_no_evaluation", label: "No evaluation was attempted" };
        case "missing_evidence":
        case "unknown_evidence":
            return { state: recorded.state, label: "Evaluation evidence is unavailable" };
        default:
            return undefined;
    }
}
/**
 * Attach check_presentation when a recorded_check fact exists. Absence is
 * not pending, baseline, or unavailable. baselineSelected covers a submit
 * that omitted verifier_id before any recorded_check event exists.
 */
export function withCheckPresentation(payload, options = {}) {
    if (!isRecord(payload))
        return payload;
    const fromRecorded = presentRecordedCheck(recordedCheckFromPayload(payload));
    if (fromRecorded)
        return { ...payload, check_presentation: fromRecorded };
    if (options.baselineSelected === true) {
        return { ...payload, check_presentation: { state: "baseline", label: BASELINE_CHECK_LABEL } };
    }
    if (options.platformTestSelected === true) {
        return { ...payload, check_presentation: { state: "platform_test", label: PLATFORM_TEST_LABEL } };
    }
    return payload;
}
/**
 * Status and result routes do not serialize recorded_check. Overlay from the
 * receipt when that fact exists. A missing or failed receipt read must not
 * invent a state or fail the original tool.
 */
export async function withCheckPresentationFromReceipt(payload, loadReceipt) {
    const fromPayload = withCheckPresentation(payload);
    if (isRecord(fromPayload) && fromPayload.check_presentation)
        return fromPayload;
    try {
        const presented = presentRecordedCheck(recordedCheckFromPayload(await loadReceipt()));
        if (presented && isRecord(payload))
            return { ...payload, check_presentation: presented };
    }
    catch {
        return fromPayload;
    }
    return fromPayload;
}
export const BASELINE_REFUSAL_MESSAGE = "solver_submit: this server refuses the built-in output-presence baseline. " +
    "Connect a customer check with the installed `@millwork/solver` CLI " +
    `(\`${PUBLIC_VERIFIER_CONNECT_COMMAND}\`) ` +
    "and pass its verifier_id.";
