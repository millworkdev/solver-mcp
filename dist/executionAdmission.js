import { hostOneRunApprovalRequest, previewRunRequest, readHostOneRunApproval, RunAdmissionError, RunAdmissionStore, } from "#solver-run-admission";
import { resolveRunAuthorizationBoundary, unsupportedRunBoundaryReport, } from "#solver-run-authorization-boundary";
import { SolverApiError } from "./errors.js";
const AUTHORITATIVE_NO_ACCEPT_PROBLEMS = new Set([
    "validation_failed",
    "echo_mode_mismatch",
    "data_class_not_available",
    "not_found",
    "invalid_state",
    "quota_exceeded",
    "insufficient_credit",
    "credit_wallet_frozen",
]);
const HOST_APPROVAL_REFUSALS = new Set([
    "missing_authorization",
    "authorization_expired",
    "authorization_revoked",
    "authorization_out_of_coverage",
    "per_run_cap_exceeded",
    "aggregate_exhausted",
    "authorization_file_invalid",
]);
export class RunAdmissionActionRequired extends Error {
    document;
    constructor(document) {
        super(typeof document.detail === "string" ? document.detail : "Run admission requires action.");
        this.document = document;
        this.name = "RunAdmissionActionRequired";
    }
}
function nonEmptyString(value) {
    return typeof value === "string" && value.trim() ? value : null;
}
function modelForArm(catalog, arm) {
    const deploymentId = nonEmptyString(arm.model_deployment_id);
    if (!deploymentId || !Array.isArray(catalog.models))
        return null;
    return catalog.models.find((entry) => entry.deployment?.model_deployment_id === deploymentId) ?? null;
}
function admissionFacts(input) {
    const accountId = nonEmptyString(input.account.tenant_id);
    const armId = nonEmptyString(input.arm.arm_id);
    const model = modelForArm(input.catalog, input.arm);
    const providerId = nonEmptyString(model?.source?.source_id);
    const accessLane = model?.connection?.access_lane;
    const fee = input.account.billing?.platform_fee_usd_per_execution;
    const platformFee = typeof fee === "number" && Number.isFinite(fee) && fee >= 0 ? fee : null;
    if (!accountId || !armId || !providerId || (accessLane !== "byok" && accessLane !== "millwork_pool")) {
        throw new RunAdmissionActionRequired({
            state: "action_required",
            refusal_code: "run_preview_unavailable",
            detail: "The selected saved model's account, provider, deployment, or paid access lane could not be verified. No paid run was submitted.",
            next_action: {
                type: "refresh_saved_model",
                detail: "Read the account, saved model, and model catalog again. Keep the same provider connection and choose a currently usable catalog model before requesting a new approval.",
            },
        });
    }
    const preview = previewRunRequest({
        account_id: accountId,
        request: input.request,
        arm_id: armId,
        provider_id: providerId,
        access_lane: accessLane,
        platform_fee_usd: platformFee,
    });
    return {
        preview,
        costReview: {
            model_key: nonEmptyString(model?.model?.model_key),
            arm_id: armId,
            source_id: providerId,
            connection_id: nonEmptyString(model?.connection?.connection_id),
            access_lane: accessLane,
            data_classes: [...input.request.policy.data_classes],
            max_runtime_s: input.request.policy.budget.max_runtime_s,
            platform_fee_usd: platformFee,
            model_budget_usd: input.request.policy.budget.max_cost_usd,
            model_usage_payer: accessLane === "byok" ? "customer_provider_account" : "millwork_credit",
            combined_allowance_usd: preview.declared_maximum_usd,
            budget_note: "Model budget is a stop threshold, not a final quote; an in-flight call can exceed it.",
        },
    };
}
function isAuthoritativeRefusal(error) {
    return error instanceof SolverApiError
        && AUTHORITATIVE_NO_ACCEPT_PROBLEMS.has(error.problem.type.split("/").at(-1) ?? "");
}
function recoveryDocument(input) {
    return {
        state: "outcome_unknown",
        refusal_code: "run_outcome_unknown",
        detail: input.detail,
        request_preview: input.preview,
        replay_key: input.replayKey,
        execution_id: input.executionId ?? input.grant.execution_id,
        submission_intent: "recover_same_run",
        next_action: {
            type: "retry_same_submission",
            detail: "Call solver_submit again with the exact same arguments and idempotency_key. Do not create a new key or change the request.",
        },
    };
}
export async function submitWithRunAdmission(input) {
    // The trust boundary is resolved before even pricing reads leave the
    // process. Launch environment and tool arguments cannot name authority.
    const resolution = await resolveRunAuthorizationBoundary();
    if (!resolution.supported) {
        const report = unsupportedRunBoundaryReport(resolution);
        throw new RunAdmissionActionRequired({
            state: "action_required",
            ...report,
            submission_intent: "new_run",
            next_action: {
                type: "use_supported_run_authorization_boundary",
                detail: "Ask the host administrator to configure the SDK README's host-owned attestation, read-only admission ledger, caller-owned recovery journal, and host-owned one-run approval channel. A prompt, tool argument, or environment variable cannot replace host approval.",
            },
        });
    }
    const armId = nonEmptyString(input.request.routing?.required_arm_id);
    if (!armId) {
        throw new RunAdmissionActionRequired({
            state: "action_required",
            refusal_code: "exact_model_required",
            detail: "A paid run must name routing.required_arm_id so its exact model, provider, access lane, and charge preview can be authorized. No paid run was submitted.",
            next_action: {
                type: "select_exact_saved_model",
                detail: "Choose a ready saved model from solver_list_arms and call solver_submit again with its arm_id and a new idempotency_key.",
            },
        });
    }
    const [account, arm, catalog] = await Promise.all([
        input.backend.request({ method: "GET", path: "account" }),
        input.backend.request({ method: "GET", path: `arms/${encodeURIComponent(armId)}` }),
        input.backend.request({ method: "GET", path: "model-catalog" }),
    ]);
    const { preview, costReview } = admissionFacts({ account, arm, catalog, request: input.request });
    const admission = new RunAdmissionStore({ boundary: resolution.boundary });
    let grant;
    try {
        grant = await admission.admit({ preview, replayKey: input.replayKey });
    }
    catch (error) {
        if (!(error instanceof RunAdmissionError) || !HOST_APPROVAL_REFUSALS.has(error.code))
            throw error;
        let approval;
        try {
            approval = await readHostOneRunApproval(resolution.boundary, preview, input.replayKey);
        }
        catch (approvalError) {
            if (!(approvalError instanceof RunAdmissionError))
                throw approvalError;
            const state = approvalError.code === "approval_expired"
                ? "expired"
                : approvalError.code === "admission_storage_unavailable"
                    ? "unknown"
                    : "failed";
            throw new RunAdmissionActionRequired({
                state,
                refusal_code: approvalError.code,
                detail: `${approvalError.message} No paid run was submitted.`,
                cost_review: costReview,
                request_preview: preview,
                replay_key: input.replayKey,
                submission_intent: "recover_same_run",
                next_action: {
                    type: state === "unknown" ? "inspect_host_approval_channel" : "replace_host_one_run_approval",
                    detail: state === "unknown"
                        ? "Ask the host administrator to inspect the protected approval channel, then retry this exact request and replay identity."
                        : "Ask the host administrator to replace the approval for this exact request and replay identity, then retry unchanged.",
                },
            });
        }
        if (!approval) {
            throw new RunAdmissionActionRequired({
                state: "action_required",
                refusal_code: "host_approval_required",
                admission_refusal_code: error.code,
                detail: "This paid run needs the host's approval for this exact request and replay identity. No paid run was submitted.",
                cost_review: costReview,
                request_preview: preview,
                replay_key: input.replayKey,
                submission_intent: "recover_same_run",
                host_approval: hostOneRunApprovalRequest(resolution.boundary, preview, input.replayKey),
                next_action: {
                    type: "obtain_host_one_run_approval",
                    detail: "Ask the host administrator to create host_approval.approval_file using host_approval.document, then call solver_submit again with the exact same arguments and idempotency_key.",
                },
            });
        }
        try {
            grant = await admission.admit({ preview, replayKey: input.replayKey, oneRunApproval: approval });
        }
        catch (approvedError) {
            if (!(approvedError instanceof RunAdmissionError))
                throw approvedError;
            throw new RunAdmissionActionRequired({
                state: "action_required",
                refusal_code: approvedError.code,
                detail: `${approvedError.message} No paid run was submitted.`,
                cost_review: costReview,
                request_preview: preview,
                replay_key: input.replayKey,
                submission_intent: "recover_same_run",
                next_action: {
                    type: approvedError.code === "charge_estimate_unavailable" ? "establish_bounded_cost" : "repair_host_approval",
                    detail: approvedError.code === "charge_estimate_unavailable"
                        ? "Choose a saved model whose access lane and platform charge are known, then request a new exact host approval."
                        : "Ask the host administrator to inspect the exact approval and replay identity before retrying unchanged.",
                },
            });
        }
    }
    if (grant.action === "inspect" && grant.execution_id) {
        try {
            return await input.backend.request({
                method: "GET",
                path: `executions/${encodeURIComponent(grant.execution_id)}`,
            });
        }
        catch {
            throw new RunAdmissionActionRequired(recoveryDocument({
                preview,
                replayKey: input.replayKey,
                grant,
                detail: "The admitted execution could not be inspected. Its outcome is unknown; no new run was authorized.",
            }));
        }
    }
    let execution;
    try {
        execution = await input.backend.request({
            method: "POST",
            path: "executions",
            body: input.request,
            idempotencyKey: input.replayKey,
        });
    }
    catch (error) {
        if (grant.action === "submit" && isAuthoritativeRefusal(error)) {
            await admission.releaseAfterAuthoritativeRefusal(grant, error instanceof Error ? error.message : "authoritative refusal");
            throw error;
        }
        throw new RunAdmissionActionRequired(recoveryDocument({
            preview,
            replayKey: input.replayKey,
            grant,
            detail: "The paid submission may have been accepted, but its outcome could not be confirmed. Its reservation was retained.",
        }));
    }
    try {
        await admission.markAccepted(grant, execution.execution_id);
    }
    catch {
        throw new RunAdmissionActionRequired(recoveryDocument({
            preview,
            replayKey: input.replayKey,
            grant,
            executionId: execution.execution_id,
            detail: "The backend accepted the run, but the local recovery record could not be confirmed. Recover this exact execution; do not start another run.",
        }));
    }
    return execution;
}
export async function settleRunAdmissionFromReceipt(input) {
    const resolution = await resolveRunAuthorizationBoundary();
    if (!resolution.supported)
        return;
    try {
        const admission = new RunAdmissionStore({ boundary: resolution.boundary });
        await admission.settleAcceptedExecution(input.executionId, input.chargedUsd);
    }
    catch (error) {
        throw new RunAdmissionActionRequired({
            state: "action_required",
            refusal_code: error instanceof RunAdmissionError ? error.code : "admission_storage_unavailable",
            detail: "The authoritative receipt was read, but the shared CLI/MCP recovery journal could not be settled.",
            execution_id: input.executionId,
            receipt: input.receipt,
            next_action: {
                type: "repair_run_recovery_journal",
                detail: "Ask the host administrator to inspect the attested recovery-journal ownership and retry solver_receipt for this same execution.",
            },
        });
    }
}
