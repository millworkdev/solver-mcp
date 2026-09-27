import { enableModelArmTool, listArmsTool, registerArmTool } from "./arms.js";
import { cancelTool, resultTool, statusTool, submitTool } from "./executions.js";
import { createSourceConnectionTool, disconnectSourceConnectionTool, listModelDeploymentsTool, listModelCatalogTool, listSourceConnectionsTool, listSourcesTool, pollSourceHandoffTool, startSourceHandoffTool, syncSourceDeploymentsTool, testSourceConnectionTool, } from "./modelSources.js";
import { proposalsTool, reviewProposalTool } from "./proposals.js";
import { receiptTool } from "./receipts.js";
// Private tool import is excluded from this public release.
// Private tool import is excluded from this public release.
import { connectVerifierTool, continueVerifierConnectionTool, disconnectVerifierConnectionTool, inspectVerifierConnectionTool, listVerifiersTool, showVerifierTool, startVerifierConnectionTool, testVerifierTool, } from "./verifiers.js";
/**
 * The tool set of the server documentation: the original eight, plus the newer
 * model-access chain, the execution result, the connection-disconnect tool,
 * and the private V4 tenant-template list/plan/apply/status/resume tools.
 * Published @millwork/solver-mcp@0.2.2 has 19: the original 18 plus disconnect.
 * The 0.2.3 public export adds the catalog read for 20 and still excludes the
 * five tenant-template tools, the four public-path verifier tools, and the
 * four protected verifier-lifecycle tools.
 * No tool ever accepts or returns raw credential material.
 */
export const allTools = [
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
