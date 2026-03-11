/**
 * Generation handler functions
 * Business logic for generation-related MCP tools
 */

import {
  generateContract,
  reviewContract,
  generateDocumentation,
  isSamplingAvailable,
} from "../../services/index.js";
import type {
  GenerateContractInput,
  ReviewContractInput,
  DocumentContractInput,
} from "./schemas.js";

/**
 * Generate a Compact contract from requirements
 */
export async function handleGenerateContract(args: GenerateContractInput) {
  const result = await generateContract(args.requirements, {
    contractType: args.contractType,
    baseExample: args.baseExample,
  });

  return {
    ...result,
    samplingAvailable: isSamplingAvailable(),
  };
}

/**
 * Review a Compact contract for issues and improvements
 */
export async function handleReviewContract(args: ReviewContractInput) {
  const result = await reviewContract(args.code);

  return {
    ...result,
    samplingAvailable: isSamplingAvailable(),
  };
}

/**
 * Generate documentation for a Compact contract
 */
export async function handleDocumentContract(args: DocumentContractInput) {
  const documentation = await generateDocumentation(args.code, args.format || "markdown");

  return {
    documentation,
    format: args.format || "markdown",
    samplingAvailable: isSamplingAvailable(),
  };
}
