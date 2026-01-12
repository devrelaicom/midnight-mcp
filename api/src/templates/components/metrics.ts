/**
 * Metric card components for the dashboard
 * Reusable metric displays with consistent styling
 */

export interface MetricCardData {
  value: string | number;
  label: string;
  tooltip?: string;
  change?: {
    value: number;
    isPositive: boolean;
  };
  icon?: string;
}

/**
 * Generate a single metric card
 */
export function generateMetricCard(data: MetricCardData): string {
  const { value, label, tooltip, change, icon } = data;

  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;

  const changeHtml = change
    ? `<span class="metric-change ${change.isPositive ? "positive" : "negative"}">
        ${change.isPositive ? "↑" : "↓"} ${Math.abs(change.value)}%
       </span>`
    : "";

  const iconHtml = icon ? `<span class="metric-icon">${icon}</span>` : "";

  const tooltipHtml = tooltip
    ? `<span class="info-icon">?</span><span class="tooltip">${tooltip}</span>`
    : "";

  const labelClass = tooltip ? "has-tooltip" : "";

  return `
    <div class="metric">
      ${iconHtml}
      <div class="metric-value">${formattedValue}${changeHtml}</div>
      <div class="metric-label ${labelClass}">
        ${label}
        ${tooltipHtml}
      </div>
    </div>
  `;
}

/**
 * Generate multiple metric cards in a row
 */
export function generateMetricCards(metrics: MetricCardData[]): string {
  return `
    <div class="metrics">
      ${metrics.map((m) => generateMetricCard(m)).join("")}
    </div>
  `;
}

/**
 * Generate the main dashboard metrics section
 */
export function generateDashboardMetrics(data: {
  totalToolCalls: number;
  totalQueries: number;
  qualityScore: number;
  successRate?: number;
  avgRelevance?: number;
  distributionTotal?: number;
}): string {
  const {
    totalToolCalls,
    totalQueries,
    qualityScore,
    successRate,
    avgRelevance,
  } = data;

  const metrics: MetricCardData[] = [
    {
      value: totalToolCalls,
      label: "Tool Calls",
      tooltip:
        "Total MCP tool invocations including search, analysis, code generation, and all other tools.",
    },
    {
      value: totalQueries,
      label: "Search Queries",
      tooltip:
        "Semantic search queries through the hosted API (compact, typescript, docs).",
    },
    {
      value: `${qualityScore}%`,
      label: "Search Quality",
      tooltip:
        "Weighted score: (High×100 + Medium×50) / Total searches. Higher is better.",
    },
  ];

  // Add success rate if available
  if (successRate !== undefined) {
    metrics.push({
      value: `${successRate}%`,
      label: "Success Rate",
      tooltip:
        "Percentage of tool calls that completed successfully (based on last 100 calls).",
    });
  }

  // Add average relevance if available
  if (avgRelevance !== undefined) {
    metrics.push({
      value: `${avgRelevance}%`,
      label: "Avg Relevance",
      tooltip:
        "Average relevance score across all search results. Higher means better matches.",
    });
  }

  return generateMetricCards(metrics);
}

/**
 * Generate a stat box with icon
 */
export function generateStatBox(data: {
  value: string | number;
  label: string;
  icon: string;
  color?: string;
}): string {
  const { value, label, icon, color = "var(--accent)" } = data;
  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;

  return `
    <div class="stat-box">
      <div class="stat-icon" style="background: ${color}20; color: ${color};">
        ${icon}
      </div>
      <div class="stat-content">
        <div class="stat-value">${formattedValue}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
}

/**
 * Generate a summary card with multiple stats
 */
export function generateSummaryCard(data: {
  title: string;
  stats: Array<{ label: string; value: string | number }>;
}): string {
  const statsHtml = data.stats
    .map(
      (stat) => `
      <div class="summary-stat">
        <span class="summary-value">${typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</span>
        <span class="summary-label">${stat.label}</span>
      </div>
    `
    )
    .join("");

  return `
    <div class="card summary-card">
      <div class="card-title">${data.title}</div>
      <div class="summary-stats">${statsHtml}</div>
    </div>
  `;
}

/**
 * Generate status indicator
 */
export function generateStatusIndicator(data: {
  status: "online" | "offline" | "warning";
  label: string;
}): string {
  return `
    <div class="status-indicator">
      <span class="status-dot ${data.status}"></span>
      <span class="status-label">${data.label}</span>
    </div>
  `;
}

/**
 * Calculate quality score from distribution
 */
export function calculateQualityScore(scoreDistribution: {
  high: number;
  medium: number;
  low: number;
}): number {
  const total =
    scoreDistribution.high + scoreDistribution.medium + scoreDistribution.low;
  if (total === 0) return 0;

  return Math.round(
    (scoreDistribution.high * 100 + scoreDistribution.medium * 50) / total
  );
}

/**
 * Calculate success rate from tool calls
 */
export function calculateSuccessRate(
  toolCalls: Array<{ success: boolean }>
): number {
  if (!toolCalls || toolCalls.length === 0) return 100;

  const successful = toolCalls.filter((t) => t.success).length;
  return Math.round((successful / toolCalls.length) * 100);
}
