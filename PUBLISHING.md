# Publishing boundary

This is the public publishing repository for the npm package
[`@millwork/solver-mcp`](https://www.npmjs.com/package/@millwork/solver-mcp).
It holds the prepared export of the package plus the pinned publishing
workflow, and nothing else. The package's engineering source is maintained
elsewhere, privately; this repository is not a mirror of that source and does
not accept source contributions.

## Prepared export

The tree is a prepared export for the next candidate version, derived from
the published, immutable `@millwork/solver-mcp@0.1.0` registry artifact:

- documentation comments in `dist/` were sanitized to remove references to
  files that do not ship in the package and internal planning identifiers;
- source maps are not shipped: their referenced sources are not public here,
  so the map files were removed and the map-reference comments stripped;
- emitted tool descriptions and the startup error use public product wording;
- package metadata was corrected — `repository` points at this repository,
  and repository-only scripts were pruned from the manifest;
- the `README.md` describes the published package as installed from the
  registry, not any private working layout;
- the version advanced to `0.1.1`, because published versions are immutable
  and are never republished — `0.1.0` predates this repository and stays
  exactly as published, without a provenance attestation.

Derivation and review evidence are retained privately, and before any
publish the exported `dist/` is re-verified against a rebuild from the
canonical source at its current head. The transformation itself is a
committed, deterministic recipe on the canonical side; its output identity
is committed here as `export-manifest.json` (per-file SHA-256s plus an
aggregate digest with its formula stated in the manifest), and
`scripts/check-export-manifest.mjs` re-verifies every byte of `dist/`
against it deterministically. `files: ["dist"]`
keeps repository-only files (this document, `scripts/`, `.github/`) out of
every packed artifact; npm always includes
`package.json`, `README.md`, and `LICENSE`.

## Continuous checks

Every pull request and push to `main` runs
[`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- `scripts/check-public-content.mjs` — deterministic public-content rules
  over every file in the working tree, this gate included, with internal
  change/row/launch reference classes rejected; `scripts/test-public-content.mjs`
  proves each rejection class and the public-support-link acceptance against
  synthetic trees (commit messages and pull-request narratives are outside
  any file gate's reach and are covered by review, not by this scan);
- `scripts/check-export-manifest.mjs` — every byte of `dist/` re-verified
  against the committed export manifest and its aggregate digest;
- actionlint (pinned, checksum-verified) over the workflows;
- `scripts/check-packed-files.mjs` — the packed file set must equal the
  exact allowlist, and the manifest must tell the truth about this
  repository;
- `scripts/smoke-installed.mjs` — packs the tree, installs the tarball into
  a clean directory on Node 20 and 22, checks `solver-mcp --help`, and
  drives a real stdio `initialize` + `tools/list`, requiring the exact
  18-name tool surface pinned in `scripts/expected-tool-surface.json` with
  public wording; `scripts/test-tool-surface.mjs` proves the comparison
  catches renames, additions, removals, and duplicates;
- `scripts/test-publish-preconditions.sh` — 16 negative cases for the
  publish guard, including mixed registry output that embeds a cached E404
  inside another failure, a failing token inspection, a literal npmrc
  token, a wrong or default dist-tag, and an expected-version mismatch.
  CI never dispatches the publish workflow and never publishes.

## Publishing

Publishing happens only through
[`.github/workflows/publish.yml`](.github/workflows/publish.yml):

- **Operator dispatch only** (`workflow_dispatch`) against the protected
  `npm-publish` environment. The operator must create and protect that
  environment (required reviewers) before the first dispatch; a dispatch is
  itself an operator gate.
- **npm trusted publishing (OIDC)** with provenance. The workflow has
  `id-token: write` and no npm token anywhere; it cannot publish until the
  operator configures the npm-side trusted publisher for
  `millworkdev/solver-mcp` / `publish.yml` / environment `npm-publish`.
- **Pinned toolchain**: GitHub-hosted `ubuntu-24.04`, Node `22.14.0`,
  npm CLI `11.5.1`, asserted exactly before any publish step.
- **Immutable-version discipline**: `scripts/verify-publish-preconditions.sh`
  proceeds only when the registry lookup parses cleanly as a single E404
  error with no other failure marker; refuses `0.1.0` (the pre-repository
  bootstrap version); requires stable SemVer equal to the operator-dispatched
  expected version; publishes only under the exact `candidate` dist-tag; and
  refuses when any token inspection finds a token or itself fails. `latest`
  is never moved by this workflow.
