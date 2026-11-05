#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildProviderMcpServer } from "./providerServer.js";
if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write("Millwork provider MCP: five read-only metadata tools, offline validation and an online dry-run check.\nUsage: solver-provider-mcp\nConfigure outside chat: MILLWORK_PROVIDER_API_KEY (scoped provider:read only), MILLWORK_PROVIDER_API_URL (including /v1).\nNo submission, webhook, operator, paid-probe, custody or customer execution tools are exposed.\n");
}
else {
    const apiKey = process.env.MILLWORK_PROVIDER_API_KEY;
    const baseUrl = process.env.MILLWORK_PROVIDER_API_URL;
    if (!apiKey || !baseUrl) {
        process.stderr.write("Provider API key and base URL are required.\n");
        process.exitCode = 1;
    }
    else {
        try {
            await buildProviderMcpServer({ apiKey, baseUrl }).connect(new StdioServerTransport());
        }
        catch {
            process.stderr.write("Provider MCP could not start. Check its configured API origin and credentials.\n");
            process.exitCode = 1;
        }
    }
}
