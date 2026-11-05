import { enableModelArmTool, listArmsTool, registerArmTool } from "./arms.js";
import { cancelTool, resultTool, statusTool, submitTool } from "./executions.js";
import { createSourceConnectionTool, disconnectSourceConnectionTool, listModelDeploymentsTool, listModelCatalogTool, listSourceConnectionsTool, listSourcesTool, pollSourceHandoffTool, startSourceHandoffTool, syncSourceDeploymentsTool, testSourceConnectionTool, } from "./modelSources.js";
import { proposalsTool, reviewProposalTool } from "./proposals.js";
import { receiptTool } from "./receipts.js";
// Private tool import is excluded from this public release.
// Private tool import is excluded from this public release.
import { connectVerifierTool, continueVerifierConnectionTool, disconnectVerifierConnectionTool, inspectVerifierConnectionTool, listVerifiersTool, showVerifierTool, startVerifierConnectionTool, testVerifierTool, } from "./verifiers.js";
/**
 * The current private tool registry, including account inventory and exact
 * route permission. The immutable published authority and the separately
 * generated current public export declare their own bounded tool sets.
 * Registration here does not grant package publication or run authority.
 * No tool ever accepts or returns raw credential material.
 */
export const allTools = [
    // Private tool entry excluded from this public release.
    // Private tool entry excluded from this public release.
    listSourcesTool,
    startSourceHandoffTool,
    pollSourceHandoffTool,
    createSourceConnectionTool,
    testSourceConnectionTool,
    listSourceConnectionsTool,
    disconnectSourceConnectionTool,
    syncSourceDeploymentsTool,
    listModelDeploymentsTool,
    listModelCatalogTool,
    enableModelArmTool,
    registerArmTool,
    listArmsTool,
    submitTool,
    // Private tool entry excluded from this public release.
    statusTool,
    cancelTool,
    resultTool,
    receiptTool,
    proposalsTool,
    reviewProposalTool,
    // Private tool entry excluded from this public release.
    // Private tool entry excluded from this public release.
    // Private tool entry excluded from this public release.
    // Private tool entry excluded from this public release.
    // Private tool entry excluded from this public release.
    listVerifiersTool,
    showVerifierTool,
    connectVerifierTool,
    testVerifierTool,
    startVerifierConnectionTool,
    inspectVerifierConnectionTool,
    continueVerifierConnectionTool,
    disconnectVerifierConnectionTool,
];
/** Lookup by tool name, for the CallTool dispatcher. */
export const toolsByName = new Map(allTools.map((tool) => [tool.name, tool]));
