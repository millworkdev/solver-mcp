import assert from "node:assert/strict";
import { test } from "node:test";
import { auditVerifierSchemas, verifierToolNames } from "./verifier-schema-audit.mjs";

const safeTools = () => verifierToolNames.map((name) => ({
  name,
  inputSchema: { type: "object", additionalProperties: false, properties: {} },
}));

test("the verifier schema audit accepts a closed, secretless surface", () => {
  assert.deepEqual(auditVerifierSchemas(safeTools()), []);
});

test("the verifier schema audit rejects nested secret fields and open objects", () => {
  const tools = safeTools();
  tools[4].inputSchema.properties.stop_choice = {
    oneOf: [{
      type: "object",
      additionalProperties: true,
      properties: { endpointSecret: { type: "string" } },
    }],
  };
  assert.deepEqual(auditVerifierSchemas(tools), [
    "solver_start_verifier_connection.stop_choice.oneOf[0]: object inputs must set additionalProperties=false",
    "solver_start_verifier_connection.stop_choice.oneOf[0].endpointSecret: secret-shaped input property",
  ]);
});

test("only operation and idempotency keys may be named in verifier inputs", () => {
  const tools = safeTools();
  tools[7].inputSchema.properties = {
    operation_key: { type: "string" },
    idempotency_key: { type: "string" },
    providerKey: { type: "string" },
  };
  assert.deepEqual(auditVerifierSchemas(tools), [
    "solver_disconnect_verifier_connection.providerKey: secret-shaped input property",
  ]);
});
