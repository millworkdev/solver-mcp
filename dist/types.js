/**
 * Wire types for the objects this MCP server touches. These mirror the TypeScript
 * SDK's wire types exactly (same snake_case wire casing,
 * same enum values) rather than importing that package: the client's build output
 * (`dist/`) is gitignored, so a `file:` dependency on `@millwork/solver` would
 * not resolve for an isolated `npm install && npm run build` of this package
 * before a monorepo/workspace layout lands (a future layout change). Keeping a
 * small, self-contained copy is the minimal-deps choice; the enum values are
 * the load-bearing part and are kept identical to the client so both surfaces reject
 * exactly what the live backend rejects.
 */
export {};
//# sourceMappingURL=types.js.map