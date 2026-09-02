#!/usr/bin/env bash
# Publish preconditions for @millwork/solver-mcp. Run from the repository
# root with DIST_TAG set. Exits nonzero (refuses) unless every rule holds:
#
#   - the manifest names exactly this package;
#   - the version is stable SemVer (no prerelease, no build metadata);
#   - the version is not 0.1.0 -- the pre-repository bootstrap version is
#     immutable, never republished, and never gains a provenance attestation;
#   - the dist-tag matches npm dist-tag syntax and is not `latest`;
#   - no npm auth token is present in the environment or npm config --
#     trusted publishing must be token-free;
#   - the registry does not already have this version, proven by a
#     definitive E404. Any other registry failure (network, 5xx, auth) is
#     indistinguishable from an unsafe state and refuses.
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

if [ "${DIST_TAG:-}" = "latest" ]; then
  echo "::error::Refusing the default dist-tag 'latest'. This workflow never moves latest." >&2
  exit 1
fi
if ! printf '%s' "${DIST_TAG:-}" | grep -Eq '^[a-z0-9][a-z0-9._-]{0,63}$'; then
  echo "::error::dist-tag '${DIST_TAG:-}' does not match the required pattern ^[a-z0-9][a-z0-9._-]{0,63}\$." >&2
  exit 1
fi

if [ -n "${NODE_AUTH_TOKEN:-}" ] || [ -n "${NPM_TOKEN:-}" ]; then
  echo "::error::An npm auth token is present in the environment; trusted publishing must be token-free." >&2
  exit 1
fi
config_token="$(npm config get //registry.npmjs.org/:_authToken 2>/dev/null || true)"
if [ -n "${config_token}" ] && [ "${config_token}" != "undefined" ] && [ "${config_token}" != "null" ]; then
  echo "::error::An npm auth token is present in npm config; trusted publishing must be token-free." >&2
  exit 1
fi

lookup_status=0
lookup_output="$(npm view "${package_name}@${package_version}" version --registry=https://registry.npmjs.org 2>&1)" || lookup_status=$?
if [ "${lookup_status}" -eq 0 ]; then
  echo "::error::${package_name}@${package_version} already exists on the registry. Published versions are immutable; bump the version instead." >&2
  exit 1
fi
# Only a definitive 404 (version absent) may proceed. Any other registry
# failure is indistinguishable from an unsafe state.
if ! printf '%s' "${lookup_output}" | grep -q 'E404'; then
  echo "::error::Registry lookup for ${package_name}@${package_version} failed for a reason other than E404; refusing to publish blind." >&2
  printf '%s\n' "${lookup_output}" >&2
  exit 1
fi

echo "${package_name}@${package_version} is unpublished; preconditions hold for dist-tag '${DIST_TAG}'."
