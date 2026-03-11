/**
 * Meta handler functions
 * Business logic for meta/discovery MCP tools
 */

import type { ExtendedToolDefinition, ToolCategory } from "../../types/index.js";
import type {
  ListToolCategoriesInput,
  ListCategoryToolsInput,
  SuggestToolInput,
} from "./schemas.js";
import { CATEGORY_INFO, INTENT_TO_TOOL } from "./schemas.js";

// Import all tool arrays to build the index
import { searchTools } from "../search/index.js";
import { analyzeTools } from "../analyze/index.js";
import { repositoryTools } from "../repository/index.js";
import { healthTools } from "../health/index.js";
import { generationTools } from "../generation/index.js";

// Late-bound import for metaTools to avoid circular dependency
let _metaTools: ExtendedToolDefinition[] = [];

/**
 * Set the meta tools reference (called after metaTools is defined)
 */
export function setMetaTools(tools: ExtendedToolDefinition[]): void {
  _metaTools = tools;
}

/**
 * Build tool index by category
 */
function getToolsByCategory(): Map<ToolCategory, ExtendedToolDefinition[]> {
  const allTools = [
    ...searchTools,
    ...analyzeTools,
    ...repositoryTools,
    ...healthTools,
    ...generationTools,
    ..._metaTools,
  ];

  const byCategory = new Map<ToolCategory, ExtendedToolDefinition[]>();

  for (const tool of allTools) {
    const category = tool.annotations?.category || "repository";
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    byCategory.get(category)!.push(tool);
  }

  return byCategory;
}

/**
 * List available tool categories
 * Use this first to understand what's available before drilling into specific tools
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function listToolCategories(_input: ListToolCategoriesInput) {
  const toolsByCategory = getToolsByCategory();

  const categories = Object.entries(CATEGORY_INFO).map(([name, info]) => ({
    name,
    description: info.description,
    toolCount: toolsByCategory.get(name as ToolCategory)?.length || 0,
    useCases: info.useCases,
  }));

  // Filter out empty categories
  const nonEmptyCategories = categories.filter((c) => c.toolCount > 0);

  const totalTools = nonEmptyCategories.reduce((sum, c) => sum + c.toolCount, 0);

  return {
    categories: nonEmptyCategories,
    totalTools,
    recommendation:
      "Start with 'compound' category for efficient multi-step operations, or 'search' to find relevant code.",
    tip: "Use midnight-list-category-tools to see tools within a specific category.",
  };
}

/**
 * List tools within a specific category
 * Progressive disclosure: drill into a category to see its tools
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function listCategoryTools(input: ListCategoryToolsInput) {
  const toolsByCategory = getToolsByCategory();
  const tools = toolsByCategory.get(input.category) || [];

  if (tools.length === 0) {
    return {
      error: `Unknown or empty category: ${input.category}`,
      availableCategories: Object.keys(CATEGORY_INFO),
      suggestion: "Use midnight-list-tool-categories to see available categories.",
    };
  }

  const categoryInfo = CATEGORY_INFO[input.category];

  return {
    category: input.category,
    description: categoryInfo.description,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description.split("\n")[0], // First line only
      title: t.annotations?.title || t.name,
      isCompound: t.annotations?.category === "compound",
      requiresSampling: t.annotations?.longRunningHint && t.annotations.category === "generation",
      ...(input.includeSchemas && {
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
      }),
    })),
    suggestion: generateCategorySuggestion(input.category),
  };
}

/**
 * Generate helpful suggestion for a category
 */
function generateCategorySuggestion(category: ToolCategory): string {
  switch (category) {
    case "compound":
      return "🚀 Compound tools save 50-70% tokens. Use midnight-upgrade-check or midnight-get-repo-context for efficient operations.";
    case "search":
      return "💡 Search tools use semantic matching - describe what you want in natural language.";
    case "generation":
      return "⚠️ Generation tools require sampling capability. They use the client's LLM for AI-powered operations.";
    case "versioning":
      return "📦 For version checks, prefer midnight-upgrade-check (compound) over individual version tools.";
    case "analyze":
      return "🔍 Analyze tools work on Compact code. Provide the contract source code directly.";
    default:
      return `Use these tools for ${CATEGORY_INFO[category].useCases[0] ?? "related operations"}.`;
  }
}

/**
 * Suggest the best tool based on user intent
 * Matches intent against patterns and category keywords
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function suggestTool(input: SuggestToolInput) {
  const intentLower = input.intent.toLowerCase();

  // First, check specific tool patterns
  const matchedTools: Array<{
    tool: string;
    reason: string;
    confidence: "high" | "medium" | "low";
    matchScore: number; // Higher = better match (more patterns or longer patterns)
  }> = [];

  for (const mapping of INTENT_TO_TOOL) {
    const matchedPatterns = mapping.patterns.filter((p) => intentLower.includes(p.toLowerCase()));
    const matchCount = matchedPatterns.length;

    if (matchCount > 0) {
      // Calculate match score: count * 10 + sum of matched pattern lengths
      // This prefers more specific (longer) patterns when counts are equal
      const patternLengthScore = matchedPatterns.reduce((sum, p) => sum + p.length, 0);
      const matchScore = matchCount * 10 + patternLengthScore;

      matchedTools.push({
        tool: mapping.tool,
        reason: mapping.reason,
        confidence: matchCount >= 2 ? "high" : "medium",
        matchScore,
      });
    }
  }

  // Also check category keywords
  const matchedCategories: Array<{
    category: ToolCategory;
    startWith: string;
    description: string;
    confidence: "medium" | "low";
  }> = [];

  for (const [category, info] of Object.entries(CATEGORY_INFO)) {
    const matchCount = info.intentKeywords.filter((k) =>
      intentLower.includes(k.toLowerCase()),
    ).length;

    if (matchCount > 0 && info.startWith) {
      matchedCategories.push({
        category: category as ToolCategory,
        startWith: info.startWith,
        description: info.description,
        confidence: matchCount >= 2 ? "medium" : "low",
      });
    }
  }

  // Sort by confidence first, then by match score (higher is better)
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  matchedTools.sort((a, b) => {
    const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    if (confDiff !== 0) return confDiff;
    // Higher match score = better, so sort descending
    return b.matchScore - a.matchScore;
  });

  // Build response
  if (matchedTools.length === 0 && matchedCategories.length === 0) {
    return {
      intent: input.intent,
      suggestions: [],
      fallback: {
        tool: "midnight-list-tool-categories",
        reason: "No specific match found. Start by exploring available tool categories.",
      },
      tip: "Try rephrasing your intent with keywords like: search, analyze, generate, upgrade, version, security, example",
    };
  }

  // Deduplicate (tools may appear in both lists)
  const seenTools = new Set<string>();
  const suggestions: Array<{
    tool: string;
    reason: string;
    confidence: string;
  }> = [];

  for (const match of matchedTools) {
    if (!seenTools.has(match.tool)) {
      seenTools.add(match.tool);
      suggestions.push(match);
    }
  }

  for (const match of matchedCategories) {
    if (!seenTools.has(match.startWith)) {
      seenTools.add(match.startWith);
      suggestions.push({
        tool: match.startWith,
        reason: `Recommended starting tool for ${match.category}: ${match.description}`,
        confidence: match.confidence,
      });
    }
  }

  // Limit to top 3 suggestions
  const topSuggestions = suggestions.slice(0, 3);

  return {
    intent: input.intent,
    suggestions: topSuggestions,
    primaryRecommendation: topSuggestions[0],
    tip:
      topSuggestions[0]?.confidence === "high"
        ? `Strong match! Use ${topSuggestions[0].tool} for this task.`
        : "Multiple tools may help. Consider the suggestions based on your specific needs.",
  };
}
