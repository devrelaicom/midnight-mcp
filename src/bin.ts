#!/usr/bin/env node

import { config } from "dotenv";
import { resolve } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { startServer, startHttpServer } from "./server.js";
import { setOutputFormat } from "./utils/index.js";
import { CURRENT_VERSION } from "./utils/version.js";

// Load .env from the current working directory
config({ path: resolve(process.cwd(), ".env") });

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

// Parse CLI arguments
const argv = yargs(hideBin(process.argv))
  .scriptName("midnight-mcp")
  .usage("$0 [options]")
  .option("http", {
    type: "boolean",
    description: "Use HTTP transport with SSE support",
    default: false,
  })
  .option("port", {
    type: "number",
    description: "HTTP port (when using --http)",
    default: 3000,
  })
  .option("github-token", {
    type: "string",
    description: "GitHub token for API access (overrides GITHUB_TOKEN env var)",
  })
  .option("json", {
    type: "boolean",
    description: "Output results in JSON format (default: YAML for better LLM efficiency)",
    default: false,
  })
  .example("$0", "Start server with stdio transport (default, for Claude Desktop)")
  .example("$0 --http --port 3000", "Start HTTP server on port 3000")
  .help()
  .alias("h", "help")
  .version(CURRENT_VERSION)
  .alias("v", "version")
  .strict()
  .parseSync();

// Override env vars with CLI args if provided
if (argv["github-token"]) {
  process.env.GITHUB_TOKEN = argv["github-token"];
}

// Set output format (YAML by default, JSON if --json flag)
setOutputFormat(argv.json);

// Determine transport mode (default to stdio if --http not specified)
const useHttp = argv.http;

async function main() {
  if (useHttp) {
    await startHttpServer(argv.port);
  } else {
    await startServer();
  }
}

main().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
