import { format, buildCacheUrl } from "../../services/playground.js";
import { logger } from "../../utils/index.js";
import type { FormatContractInput } from "./schemas.js";

export async function formatContract(input: FormatContractInput) {
  logger.debug("Formatting Compact contract");
  const result = await format(input.code, {
    version: input.version,
    versions: input.versions,
  });
  return {
    success: result.success,
    formatted: result.formatted,
    changed: result.changed,
    diff: result.diff,
    ...(result.cacheKey && {
      cacheKey: result.cacheKey,
      cacheUrl: buildCacheUrl(result.cacheKey),
    }),
  };
}
