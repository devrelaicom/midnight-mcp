import { diff, buildCacheUrl } from "../../services/playground.js";
import { logger } from "../../utils/index.js";
import type { DiffContractsInput } from "./schemas.js";

export async function diffContracts(input: DiffContractsInput) {
  logger.debug("Diffing Compact contracts");
  const result = await diff(input.before, input.after);
  return {
    hasChanges: result.hasChanges,
    circuits: result.circuits,
    ledger: result.ledger,
    pragma: result.pragma,
    imports: result.imports,
    ...(result.cacheKey && {
      cacheKey: result.cacheKey,
      cacheUrl: buildCacheUrl(result.cacheKey),
    }),
  };
}
