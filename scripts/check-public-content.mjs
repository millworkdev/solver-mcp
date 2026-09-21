// Deterministic public-content check for this publishing repository.
//
// Everything in this repository is permanent public history, and the packed
// file set becomes an immutable registry artifact. This scan fails closed on
// content that must never appear here: references to files that do not exist
// in this repository or in the packed artifact, internal planning or product
// identifiers, superseded jargon, bare 40-hex commit identifiers outside
// workflow action pins, absolute filesystem paths, secret-shaped material,
// source maps whose referenced sources are not public here or that embed
// source text, and links to repositories other than this one.
//
// EVERY file in the tree is scanned, this script included. The forbidden
// identifiers below are assembled from fragments so the scan can describe
// them without containing them.
//
// Run: node scripts/check-public-content.mjs   (exits nonzero on violation)

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// An explicit root argument lets the negative-fixture tests point this exact
// scanner at synthetic trees; without one it scans this repository.
const repositoryRoot = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function resolvesInsideRepository(candidate) {
  const within = relative(repositoryRoot, candidate);
  return within !== "" && !within.startsWith("..") && !isAbsolute(within);
}

function listFiles(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    if (name === ".git" || name === "node_modules") continue;
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) entries.push(...listFiles(fullPath));
    else entries.push(relative(repositoryRoot, fullPath).split("\\").join("/"));
  }
  return entries;
}

const allFiles = listFiles(repositoryRoot).sort();
const mapFiles = allFiles.filter((path) => path.endsWith(".map"));
const textFiles = allFiles.filter((path) => !path.endsWith(".map"));

const allowedUrlPatterns = [
  /^https:\/\/github\.com\/millworkdev\/solver-mcp(?:\.git|\/|$|\b)/,
  /^https?:\/\/(?:www\.)?npmjs\.com\//,
  /^https:\/\/registry\.npmjs\.org(?:\/|$)/,
  /^https?:\/\/(?:www\.)?apache\.org\//,
  /^https:\/\/api\.getmillwork\.dev\//,
  /^https:\/\/docs\.getmillwork\.dev(?:\/|$)/,
  // The two customer destinations the CLI prints. Anchored to these exact
  // paths: no other app subpath, and no host lookalike, is allowed.
  // Trailing sentence punctuation is tolerated because the URL matcher above
  // stops only at whitespace and brackets, so prose ending on this link would
  // otherwise fail. It cannot widen the host or admit another path.
  /^https:\/\/app\.getmillwork\.dev\/(?:keys|billing)[.,;:]?$/,
  /^https?:\/\/docs\.npmjs\.com\//,
  /^https:\/\/github\.com\/rhysd\/actionlint\//,
  /^https:\/\/claude\.com\/claude-code\b/,
];

// Assembled from fragments so this file passes its own scan.
const jargonWord = ["B", "YOK"].join("");
const internalProductWord = ["Solver", "API"].join("");
const planningWord = ["punch", "list"].join("-?");
const agentFileWord = `(?:${["AGE", "NTS"].join("")}|${["CLA", "UDE"].join("")})\\.md`;

const forbiddenPatterns = [
  { id: "internal-planning-term", pattern: new RegExp(`\\b${planningWord}\\b|\\bSlice [A-Z]\\b`, "i") },
  { id: "agent-instruction-file", pattern: new RegExp(`\\b${agentFileWord}\\b`) },
  { id: "internal-product-name", pattern: new RegExp(`\\b${internalProductWord}\\b`) },
  { id: "superseded-jargon", pattern: new RegExp(jargonWord) },
  // Internal operational references: change/issue/ticket numbers and
  // planning row identifiers. URLs are stripped before this scan, so a
  // legitimate public support link never reaches these patterns.
  { id: "internal-change-reference", pattern: /\b(?:PR|MR|issue|ticket) ?#[0-9]+\b/i },
  { id: "internal-row-reference", pattern: /\brow [A-Z]{1,3}[0-9]+\b/i },
  { id: "launch-reference", pattern: new RegExp(`\\b${["inter", "nal"].join("")}[- ]launch\\b`, "i") },
  { id: "absolute-path", pattern: /(?:^|["'\s(=])\/(?:Users|home|private\/tmp|var\/folders)\// },
  { id: "secret-material", pattern: new RegExp(["-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----", "\\bnpm_[A-Za-z0-9]{20,}\\b", "\\bgh[pousr]_[A-Za-z0-9_]{20,}\\b", "\\bgithub_" + "pat_[A-Za-z0-9_]{20,}\\b", "\\bAKIA[0-9A-Z]{16}\\b"].join("|")) },
];

// A repository-layout path reference (a slash path ending in a
// dot-extension) is allowed
// only when the referenced file actually exists here, resolved against the
// repository root or against the referencing file's own directory. A
// reference that is part of an npm package specifier (preceded by "@") is a
// dependency import, not a repository path. Anything else points a permanent
// public reader at material that is not public.
const pathReferencePattern = /(?:\.\.?\/)*[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[A-Za-z]{1,5}\b/g;

// Absolute host paths the product names on purpose. These are locations on the
// machine running the server, not files this repository could ever ship, so
// the "does it exist here?" rule does not apply to them. Each is listed
// exactly, with its leading slash: a repository-relative lookalike still fails.
const allowedHostPaths = [
  "/etc/millwork/run-authorization-boundary.json",
];


for (const path of textFiles) {
  const raw = readFileSync(resolve(repositoryRoot, path), "utf8");
  const urls = raw.match(/https?:\/\/[^\s"'`)\]>]+/g) ?? [];
  for (const url of urls) {
    if (!allowedUrlPatterns.some((pattern) => pattern.test(url))) {
      failures.push(`${path}: URL outside the allowed public set: ${url}`);
    }
  }
  // Scan with URLs removed so hostname/path segments are not double-counted.
  const text = raw.replace(/https?:\/\/[^\s"'`)\]>]+/g, " ");
  for (const { id, pattern } of forbiddenPatterns) {
    const match = text.match(pattern);
    if (match) failures.push(`${path}: forbidden content (${id}): ${match[0]}`);
  }
  if (!path.startsWith(".github/workflows/")) {
    const shaMatch = text.match(/\b[0-9a-f]{40}\b/);
    if (shaMatch) failures.push(`${path}: bare 40-hex commit identifier outside a workflow action pin`);
  }
  for (const referenceMatch of text.matchAll(pathReferencePattern)) {
    const reference = referenceMatch[0];
    if (referenceMatch.index > 0 && text[referenceMatch.index - 1] === "@") continue;
    // Only when the match is the whole of one of those exact absolute paths,
    // compared as a complete token. A slash must immediately precede it, and
    // what follows depends on where the token sits:
    //   - inside a quoted string (the slash is preceded by a quote), the very
    //     next character must be that same closing quote: the literal is the
    //     whole file name, and "boundary.json:" is a different file name;
    //   - in prose (the slash is preceded by the start of the text, whitespace
    //     or an opening bracket), the token must end at whitespace or the end
    //     of the text, allowing up to two characters of sentence punctuation
    //     or closing brackets before that ("... boundary.json." / "(...json).");
    //   - anywhere else, whitespace or the end of the text must follow directly.
    const tokenStart = referenceMatch.index - 1;
    const tokenEnd = referenceMatch.index + reference.length;
    const before = tokenStart > 0 ? text[tokenStart - 1] : "";
    const following = text.slice(tokenEnd, tokenEnd + 3);
    let closed;
    if (before === '"' || before === "'" || before === "`") {
      closed = following[0] === before;
    } else if (before === "" || /[\s(\[]/.test(before)) {
      closed = /^[.,;:!?)\]]{0,2}(?:$|\s)/.test(following);
    } else {
      closed = /^(?:$|\s)/.test(following);
    }
    if (closed && allowedHostPaths.some((hostPath) => hostPath === `/${reference}` && text[tokenStart] === "/")) continue;
    const fromRoot = resolve(repositoryRoot, reference);
    const fromFile = resolve(repositoryRoot, dirname(path), reference);
    // Containment before existence: a relative reference can escape the root,
    // and a sync workspace routinely has private checkouts as siblings, so
    // testing existence alone accepts the pointer exactly when the nonpublic
    // file is really there -- the one case this scan exists to reject.
    const satisfied = [fromRoot, fromFile].some(
      (candidate) => resolvesInsideRepository(candidate) && existsSync(candidate),
    );
    if (!satisfied) {
      failures.push(`${path}: reference to a file that is not public here: ${reference}`);
    }
  }
}

// Source maps may only exist when every referenced source resolves inside
// this repository and no source text is embedded. The prepared export ships
// no source maps at all, so any .map file is itself suspicious and must
// fully justify its references.
for (const path of mapFiles) {
  const map = JSON.parse(readFileSync(resolve(repositoryRoot, path), "utf8"));
  if ("sourcesContent" in map) {
    failures.push(`${path}: source map embeds source text (sourcesContent)`);
  }
  for (const source of map.sources ?? []) {
    if (source.startsWith("/") || /^[A-Za-z]+:/.test(source)) {
      failures.push(`${path}: non-relative source map source: ${source}`);
      continue;
    }
    const resolved = resolve(repositoryRoot, dirname(path), source);
    if (!resolved.startsWith(repositoryRoot + "/") || !existsSync(resolved)) {
      failures.push(`${path}: source map source does not resolve to a public file here: ${source}`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(failures.map((failure) => `FAIL ${failure}`).join("\n") + "\n");
  process.exit(1);
}
process.stdout.write(`public-content check ok (${textFiles.length} text files, ${mapFiles.length} source maps)\n`);
