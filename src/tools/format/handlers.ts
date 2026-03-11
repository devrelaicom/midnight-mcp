import { format } from "../../services/playground.js";
import { logger } from "../../utils/index.js";
import type { FormatContractInput } from "./schemas.js";

export async function formatContract(input: FormatContractInput) {
  logger.debug("Formatting Compact contract");
  const result = await format(input.code, { version: input.version });
  return {
    success: result.success,
    formatted: result.formatted,
    changed: result.changed,
    diff: result.diff,
  };
}
