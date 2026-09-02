/**
 * Wire types for the objects this MCP server touches. These mirror the S1
 * SDK's `packages/sdk-ts/src/types.ts` exactly (same snake_case wire casing,
 * same enum values) rather than importing that package: S1's build output
 * (`dist/`) is gitignored, so a `file:` dependency on `@millwork/solver` would
 * not resolve for an isolated `npm install && npm run build` of this package
 * before a monorepo/workspace layout lands (punchlist row S4). Keeping a
 * small, self-contained copy is the minimal-deps choice; the enum values are
 * the load-bearing part and are kept identical to S1 so both surfaces reject
 * exactly what the live backend rejects.
 */
export {};
//# sourceMappingURL=types.js.map