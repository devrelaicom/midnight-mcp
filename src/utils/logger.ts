/**
 * Application logger — thin wrapper around LogTape.
 *
 * Consumers continue to use: logger.debug/info/warn/error(message, properties?)
 *
 * Redaction (field-name, regex, truncation) and MCP forwarding are handled
 * by the LogTape configuration in logtape-setup.ts.
 */

import { getLogger } from "@logtape/logtape";

export const logger = getLogger("midnight-mcp");

// Re-export lifecycle functions so existing import paths keep working.
export { initLogging, setMCPLogFunction, resetLoggerState } from "./logtape-setup.js";
