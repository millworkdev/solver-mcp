// Audit the installed verifier tool inputs, including nested alternatives.
// Only opaque operation/idempotency references may cross the MCP boundary.
export const verifierToolNames = [
  "solver_list_verifiers",
  "solver_show_verifier",
  "solver_connect_verifier",
  "solver_test_verifier",
  "solver_start_verifier_connection",
  "solver_inspect_verifier_connection",
  "solver_continue_verifier_connection",
  "solver_disconnect_verifier_connection",
];

const forbiddenProperty = /(?:^|_)(?:secret|password|credential|token|auth_ref|handle)(?:$|_)/;

function isSecretShaped(name) {
  const normalized = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (forbiddenProperty.test(normalized)) return true;
  return normalized.endsWith("_key") && normalized !== "idempotency_key" && normalized !== "operation_key";
}

function walkSchema(schema, path, findings) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type === "object" && schema.additionalProperties !== false) {
    findings.push(`${path}: object inputs must set additionalProperties=false`);
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    if (isSecretShaped(name)) findings.push(`${path}.${name}: secret-shaped input property`);
    walkSchema(child, `${path}.${name}`, findings);
  }
  for (const alternative of ["oneOf", "anyOf", "allOf"]) {
    for (const [index, child] of (schema[alternative] ?? []).entries()) {
      walkSchema(child, `${path}.${alternative}[${index}]`, findings);
    }
  }
  if (schema.items) walkSchema(schema.items, `${path}.items`, findings);
}

export function auditVerifierSchemas(tools) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const findings = [];
  for (const name of verifierToolNames) {
    const tool = byName.get(name);
    if (!tool) {
      findings.push(`${name}: missing from installed surface`);
      continue;
    }
    walkSchema(tool.inputSchema, name, findings);
  }
  return findings;
}
