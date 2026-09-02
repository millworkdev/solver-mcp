import { enableModelArmTool, listArmsTool, registerArmTool } from "./arms.js";
import { cancelTool, resultTool, statusTool, submitTool } from "./executions.js";
import { createSourceConnectionTool, listModelDeploymentsTool, listSourceConnectionsTool, listSourcesTool, pollSourceHandoffTool, startSourceHandoffTool, syncSourceDeploymentsTool, testSourceConnectionTool, } from "./modelSources.js";
import { proposalsTool, reviewProposalTool } from "./proposals.js";
import { receiptTool } from "./receipts.js";
/**
 * The tool set of the server documentation: the original eight, plus the newer
 * model-access chain (source listing -> hosted credential handoff ->
 * connection -> deployments -> deployment-bound arm enablement) and the
 * execution result. Ordered as a customer walks them: connect supply, enable
 * an arm, submit, observe, read the result and receipt, review repairs.
 * No tool ever accepts or returns raw credential material.
 */
export const allTools = [
    listSourcesTool,
    startSourceHandoffTool,
    pollSourceHandoffTool,
    createSourceConnectionTool,
    testSourceConnectionTool,
    listSourceConnectionsTool,
    syncSourceDeploymentsTool,
    listModelDeploymentsTool,
    enableModelArmTool,
    registerArmTool,
    listArmsTool,
    submitTool,
    statusTool,
    cancelTool,
    resultTool,
    receiptTool,
    proposalsTool,
    reviewProposalTool,
];
/** Lookup by tool name, for the CallTool dispatcher. */
export const toolsByName = new Map(allTools.map((tool) => [tool.name, tool]));
