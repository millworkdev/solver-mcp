#!/usr/bin/env bash
# Negative cases for scripts/verify-publish-preconditions.sh. Each scenario
# shims `npm` on PATH (never touching the real registry) and asserts the
# guard refuses -- or, for the one safe case, proceeds. Nothing here
# dispatches a workflow or publishes.
#
# Run: bash scripts/test-publish-preconditions.sh
set -euo pipefail

repository_root="$(cd "$(dirname "$0")/.." && pwd)"
work_directory="$(mktemp -d)"
trap 'rm -rf "${work_directory}"' EXIT

failures=0

# Build an isolated copy of the guard's inputs so scenarios can vary the
# manifest without touching the repository.
stage_scenario() {
  local scenario_name="$1" version="$2" npm_mode="$3"
  local scenario_directory="${work_directory}/${scenario_name}"
  mkdir -p "${scenario_directory}/bin"
  node --eval "
    const manifest = require('${repository_root}/package.json');
    manifest.version = '${version}';
    require('node:fs').writeFileSync('${scenario_directory}/package.json', JSON.stringify(manifest, null, 2));
  "
  cp "${repository_root}/scripts/verify-publish-preconditions.sh" "${scenario_directory}/verify.sh"
  cat > "${scenario_directory}/bin/npm" <<SHIM
#!/usr/bin/env bash
if [ "\$1" = "config" ]; then echo "undefined"; exit 0; fi
case "${npm_mode}" in
  version-exists) echo "0.1.1"; exit 0 ;;
  e404) echo "npm error code E404 -- not in this registry" >&2; exit 1 ;;
  network-failure) echo "npm error code ENOTFOUND -- getaddrinfo failed" >&2; exit 1 ;;
esac
exit 1
SHIM
  chmod +x "${scenario_directory}/bin/npm" "${scenario_directory}/verify.sh"
  printf '%s' "${scenario_directory}"
}

run_scenario() {
  local scenario_name="$1" version="$2" npm_mode="$3" dist_tag="$4" expectation="$5"
  shift 5
  local scenario_directory
  scenario_directory="$(stage_scenario "${scenario_name}" "${version}" "${npm_mode}")"
  local guard_status=0
  (
    cd "${scenario_directory}" &&
    env "$@" PATH="${scenario_directory}/bin:${PATH}" DIST_TAG="${dist_tag}" bash verify.sh
  ) > "${scenario_directory}/output" 2>&1 || guard_status=$?
  if [ "${expectation}" = "refuses" ] && [ "${guard_status}" -eq 0 ]; then
    echo "FAIL ${scenario_name}: expected the guard to refuse, but it proceeded"
    cat "${scenario_directory}/output"
    failures=$((failures + 1))
  elif [ "${expectation}" = "proceeds" ] && [ "${guard_status}" -ne 0 ]; then
    echo "FAIL ${scenario_name}: expected the guard to proceed, but it refused"
    cat "${scenario_directory}/output"
    failures=$((failures + 1))
  else
    echo "ok ${scenario_name} (${expectation})"
  fi
}

run_scenario "unpublished-version-proceeds"   "0.1.1"      e404            candidate proceeds
run_scenario "existing-version-refuses"       "0.1.1"      version-exists  candidate refuses
run_scenario "network-failure-refuses"        "0.1.1"      network-failure candidate refuses
run_scenario "bootstrap-version-refuses"      "0.1.0"      e404            candidate refuses
run_scenario "prerelease-version-refuses"     "0.2.0-rc.1" e404            candidate refuses
run_scenario "latest-dist-tag-refuses"        "0.1.1"      e404            latest    refuses
run_scenario "malformed-dist-tag-refuses"     "0.1.1"      e404            "Bad Tag" refuses
run_scenario "ambient-token-refuses"          "0.1.1"      e404            candidate refuses NODE_AUTH_TOKEN=shim-token-value

if [ "${failures}" -gt 0 ]; then
  echo "${failures} precondition scenario(s) failed"
  exit 1
fi
echo "publish-precondition negatives ok (8 scenarios)"
