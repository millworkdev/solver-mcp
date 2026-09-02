#!/usr/bin/env bash
# Publish preconditions for @millwork/solver-mcp. Run from the repository
# root with DIST_TAG and EXPECTED_VERSION set. Exits nonzero (refuses)
# unless every rule holds:
#
#   - the manifest names exactly this package;
#   - the version is stable SemVer (no prerelease, no build metadata) and
#     equals the operator-confirmed EXPECTED_VERSION;
#   - the version is not 0.1.0 -- the pre-repository bootstrap version is
#     immutable, never republished, and never gains a provenance attestation;
#   - the dist-tag is exactly `candidate`;
#   - no npm auth token is present in the environment or in any applicable
#     npm configuration, and every token inspection must itself succeed --
#     a failing inspection refuses rather than concealing a token;
#   - the registry definitively reports the version absent: the JSON error
#     output must parse cleanly with error code exactly E404 and carry no
#     other failure marker. Mixed or unparseable output (DNS, timeout,
#     auth, 5xx, cached fragments) refuses.
#
# This script performs no publish and no mutation of any kind.
set -euo pipefail

package_name="$(node --print "require('./package.json').name")"
package_version="$(node --print "require('./package.json').version")"

if [ "${package_name}" != "@millwork/solver-mcp" ]; then
  echo "::error::This workflow publishes only @millwork/solver-mcp; the manifest names ${package_name}." >&2
  exit 1
fi

if ! printf '%s' "${package_version}" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'; then
  echo "::error::Version '${package_version}' is not stable SemVer; candidates publish stable versions only." >&2
  exit 1
fi

if [ "${package_version}" = "0.1.0" ]; then
  echo "::error::0.1.0 is the immutable bootstrap version. It is never republished and never gains provenance." >&2
  exit 1
fi

if [ -z "${EXPECTED_VERSION:-}" ] || [ "${package_version}" != "${EXPECTED_VERSION:-}" ]; then
  echo "::error::Manifest version '${package_version}' does not equal the operator-confirmed expected version '${EXPECTED_VERSION:-}'." >&2
  exit 1
fi

if [ "${DIST_TAG:-}" != "candidate" ]; then
  echo "::error::This workflow publishes only under the exact dist-tag 'candidate'; got '${DIST_TAG:-}'. latest is never moved." >&2
  exit 1
fi

if [ -n "${NODE_AUTH_TOKEN:-}" ] || [ -n "${NPM_TOKEN:-}" ] || [ -n "${NPM_CONFIG__AUTH:-}" ]; then
  echo "::error::An npm auth token is present in the environment; trusted publishing must be token-free." >&2
  exit 1
fi
# Every token inspection must itself succeed; a failing inspection could
# conceal a configured token, so it refuses.
token_probe_status=0
config_token="$(npm config get //registry.npmjs.org/:_authToken 2>&1)" || token_probe_status=$?
if [ "${token_probe_status}" -ne 0 ]; then
  echo "::error::npm token inspection failed (exit ${token_probe_status}); refusing rather than concealing a token." >&2
  printf '%s\n' "${config_token}" >&2
  exit 1
fi
if [ -n "${config_token}" ] && [ "${config_token}" != "undefined" ] && [ "${config_token}" != "null" ]; then
  echo "::error::An npm auth token is present in npm config; trusted publishing must be token-free." >&2
  exit 1
fi
# A literal token value in any applicable npmrc refuses. An unresolved
# environment reference (e.g. a value starting with "$") is the inert
# placeholder setup-node writes and resolves through the environment checks
# above; a literal value is a real credential and fails closed.
for npmrc_path in ./.npmrc "${HOME}/.npmrc" "${NPM_CONFIG_USERCONFIG:-}"; do
  if [ -n "${npmrc_path}" ] && [ -f "${npmrc_path}" ] && grep -Eq '_authToken[[:space:]]*=[[:space:]]*[^[:space:]$]' "${npmrc_path}"; then
    echo "::error::${npmrc_path} carries a literal npm auth token entry; trusted publishing must be token-free." >&2
    exit 1
  fi
done

lookup_status=0
lookup_output="$(npm view "${package_name}@${package_version}" version --json --registry=https://registry.npmjs.org 2>/dev/null)" || lookup_status=$?
if [ "${lookup_status}" -eq 0 ]; then
  echo "::error::${package_name}@${package_version} already exists on the registry. Published versions are immutable; bump the version instead." >&2
  exit 1
fi
# Only a definitive, cleanly-parsed E404 (version absent) may proceed:
# the entire JSON output must be one object whose error code is exactly
# E404, with no other failure marker anywhere in it. Anything else is
# indistinguishable from an unsafe state and refuses.
if ! printf '%s' "${lookup_output}" | node --input-type=module --eval '
  import { readFileSync } from "node:fs";
  const raw = readFileSync(0, "utf8");
  let parsed;
  try { parsed = JSON.parse(raw); } catch { process.exit(1); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) process.exit(1);
  if (Object.keys(parsed).length !== 1 || !parsed.error) process.exit(1);
  if (parsed.error.code !== "E404") process.exit(1);
  if (/\bE(?:NOTFOUND|TIMEDOUT|CONNREFUSED|AI_AGAIN|OTP|401|403|5\d\d)\b/.test(raw)) process.exit(1);
  process.exit(0);
'; then
  echo "::error::Registry lookup for ${package_name}@${package_version} did not produce a definitive E404; refusing to publish blind." >&2
  printf '%s\n' "${lookup_output}" >&2
  exit 1
fi

echo "${package_name}@${package_version} is definitively unpublished; preconditions hold for dist-tag '${DIST_TAG}'."
