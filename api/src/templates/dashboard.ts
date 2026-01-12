/**
 * Dashboard HTML template generator
 * Orchestrates dashboard components for comprehensive analytics view
 */

import type { Metrics } from "../interfaces";
import {
  generatePageWrapper,
  generateCard,
  generateGrid,
  generateEmptyState,
} from "./components/layout";
import {
  generateDashboardMetrics,
  calculateQualityScore,
} from "./components/metrics";
import {
  generateBarChart,
  generateRepoChart,
  generateQualityBoxes,
  generateDonutChart,
} from "./components/charts";
import {
  generateQueriesTable,
  generateToolCallsTable,
} from "./components/tables";
import { escapeHtml, escapeAttr } from "./components/html-utils";

/**
 * Generate the complete dashboard HTML page
 */
export function generateDashboardHtml(metrics: Metrics): string {
  const content =
    metrics.totalQueries === 0 && (metrics.totalToolCalls || 0) === 0
      ? generateEmptyState("No activity recorded yet", {
          icon: "📊",
          action: { label: "Refresh", onclick: "location.reload()" },
        })
      : generateDashboardContent(metrics);

  return generatePageWrapper(content, {
    title: "MCP Analytics",
    description: "Midnight MCP Server Analytics Dashboard",
    refreshable: true,
    lastUpdated: metrics.lastUpdated,
  });
}

/**
 * Generate the main dashboard content
 */
function generateDashboardContent(metrics: Metrics): string {
  const totalToolCalls = metrics.totalToolCalls || 0;
  const toolCallsByName = metrics.toolCallsByName || {};
  const recentToolCalls = metrics.recentToolCalls || [];

  // Calculate derived metrics from score distribution (based on ALL queries, not just recent)
  const distributionTotal =
    metrics.scoreDistribution.high +
    metrics.scoreDistribution.medium +
    metrics.scoreDistribution.low;

  // Quality score uses the distribution which is accurate for all queries
  const qualityScore = calculateQualityScore(metrics.scoreDistribution);

  // Success rate from recent tool calls (last 100)
  const successfulCalls = recentToolCalls.filter((t) => t.success).length;
  const failedCalls = recentToolCalls.length - successfulCalls;
  const successRate =
    recentToolCalls.length > 0
      ? Math.round((successfulCalls / recentToolCalls.length) * 100)
      : 100;

  // Average relevance score (0-100 scale)
  const avgRelevance = Math.round((metrics.avgRelevanceScore || 0) * 100);

  return `
    ${generateDashboardMetrics({
      totalToolCalls,
      totalQueries: metrics.totalQueries,
      qualityScore,
      successRate,
      avgRelevance,
      distributionTotal,
    })}
    
    ${generateOverviewSection(metrics, totalToolCalls, toolCallsByName)}
    
    ${generateActivitySection(metrics, recentToolCalls)}
    
    ${generateInsightsSection(metrics, qualityScore, successRate, failedCalls, avgRelevance)}
  `;
}

/**
 * Generate overview section with charts
 */
function generateOverviewSection(
  metrics: Metrics,
  totalToolCalls: number,
  toolCallsByName: Record<string, number>
): string {
  const toolUsageCard = generateCard(
    generateBarChart(toolCallsByName, totalToolCalls, {
      maxItems: 8,
      emptyMessage: "No tool usage data",
    }),
    { title: "Tool Usage" }
  );

  const searchByTypeCard = generateCard(
    generateBarChart(metrics.queriesByEndpoint, metrics.totalQueries, {
      maxItems: 5,
      emptyMessage: "No search data",
    }),
    { title: "Search by Type" }
  );

  const qualityCard = generateCard(
    generateQualityBoxes(metrics.scoreDistribution),
    { title: "Search Quality Distribution" }
  );

  const repoCard = generateCard(
    generateRepoChart(metrics.documentsByRepo, {
      maxItems: 5,
      emptyMessage: "No repositories indexed",
    }),
    { title: "Top Repositories" }
  );

  return generateGrid([toolUsageCard, searchByTypeCard, qualityCard, repoCard]);
}

/**
 * Generate activity section with recent data tables
 */
function generateActivitySection(
  metrics: Metrics,
  recentToolCalls: Metrics["recentToolCalls"]
): string {
  const toolCallsCard = generateCard(
    generateToolCallsTable(recentToolCalls || [], {
      maxRows: 10,
      emptyMessage: "No recent tool calls",
    }),
    { title: "Recent Tool Calls" }
  );

  const queriesCard = generateCard(
    generateQueriesTable(metrics.recentQueries, {
      maxRows: 15,
      emptyMessage: "No recent searches",
    }),
    { title: "Recent Searches" }
  );

  return generateGrid([toolCallsCard, queriesCard]);
}

/**
 * Generate insights section with analytics
 */
function generateInsightsSection(
  metrics: Metrics,
  qualityScore: number,
  successRate: number,
  failedCalls: number,
  avgRelevance: number
): string {
  // Calculate additional insights
  const totalSearches = metrics.totalQueries;
  const { high, medium, low } = metrics.scoreDistribution;
  const distributionTotal = high + medium + low;

  // High quality rate based on distribution (not totalQueries which may differ)
  const highQualityRate =
    distributionTotal > 0 ? Math.round((high / distributionTotal) * 100) : 0;

  // Medium quality rate
  const mediumQualityRate =
    distributionTotal > 0 ? Math.round((medium / distributionTotal) * 100) : 0;

  // Low quality rate
  const lowQualityRate =
    distributionTotal > 0 ? Math.round((low / distributionTotal) * 100) : 0;

  // Most used tools
  const toolCallsByName = metrics.toolCallsByName || {};
  const totalToolCalls = metrics.totalToolCalls || 0;
  const topTools = Object.entries(toolCallsByName)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Most searched types with percentages
  const topEndpoints = Object.entries(metrics.queriesByEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Language breakdown
  const languageBreakdown = Object.entries(metrics.queriesByLanguage || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Calculate tool usage percentages
  const topToolsWithPct = topTools.map(([name, count]) => ({
    name,
    count,
    pct: totalToolCalls > 0 ? Math.round((count / totalToolCalls) * 100) : 0,
  }));

  // Calculate endpoint percentages
  const topEndpointsWithPct = topEndpoints.map(([name, count]) => ({
    name,
    count,
    pct: totalSearches > 0 ? Math.round((count / totalSearches) * 100) : 0,
  }));

  const insightsHtml = `
    <div class="insights-grid">
      <div class="insight-card">
        ${generateDonutChart(qualityScore, "Quality", { color: getQualityColor(qualityScore) })}
        <div class="insight-details">
          <h4>Search Quality Score</h4>
          <p>${getQualityMessage(qualityScore)}</p>
        </div>
      </div>
      
      <div class="insight-card">
        <h4>Quality Breakdown</h4>
        <div class="insight-stats">
          <div class="insight-stat">
            <span class="stat-number" style="color: var(--success)">${highQualityRate}%</span>
            <span class="stat-desc">High (≥70%)</span>
          </div>
          <div class="insight-stat">
            <span class="stat-number" style="color: var(--warning)">${mediumQualityRate}%</span>
            <span class="stat-desc">Medium (40-69%)</span>
          </div>
          <div class="insight-stat">
            <span class="stat-number" style="color: var(--error)">${lowQualityRate}%</span>
            <span class="stat-desc">Low (&lt;40%)</span>
          </div>
        </div>
      </div>
      
      <div class="insight-card">
        ${generateDonutChart(successRate, "Success", { color: successRate >= 95 ? "var(--success)" : successRate >= 80 ? "var(--warning)" : "var(--error)" })}
        <div class="insight-details">
          <h4>Tool Success Rate</h4>
          <p>${failedCalls === 0 ? "All recent calls succeeded!" : `${failedCalls} failed call${failedCalls > 1 ? "s" : ""} in last 100`}</p>
        </div>
      </div>
      
      <div class="insight-card">
        ${generateDonutChart(avgRelevance, "Relevance", { color: avgRelevance >= 60 ? "var(--success)" : avgRelevance >= 40 ? "var(--warning)" : "var(--error)" })}
        <div class="insight-details">
          <h4>Avg Relevance Score</h4>
          <p>${getRelevanceMessage(avgRelevance)}</p>
        </div>
      </div>
    </div>
    
    <div class="insights-grid" style="margin-top: var(--space-lg);">
      <div class="insight-card">
        <h4>Top Tools (by usage)</h4>
        <ul class="insight-list">
          ${topToolsWithPct.length > 0 ? topToolsWithPct.map(({ name, count, pct }) => `<li><span>${escapeHtml(name)}</span><span><span class="tag info">${count}</span> <span style="color: var(--muted); font-size: 11px;">(${pct}%)</span></span></li>`).join("") : '<li style="color: var(--muted)">No tool calls yet</li>'}
        </ul>
      </div>
      
      <div class="insight-card">
        <h4>Search by Endpoint</h4>
        <ul class="insight-list">
          ${topEndpointsWithPct.length > 0 ? topEndpointsWithPct.map(({ name, count, pct }) => `<li><span>${escapeHtml(name)}</span><span><span class="tag info">${count}</span> <span style="color: var(--muted); font-size: 11px;">(${pct}%)</span></span></li>`).join("") : '<li style="color: var(--muted)">No searches yet</li>'}
        </ul>
      </div>
      
      <div class="insight-card">
        <h4>Top Repositories</h4>
        <ul class="insight-list">
          ${
            Object.entries(metrics.documentsByRepo)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(
                ([repo, count]) =>
                  `<li><span title="${escapeAttr(repo)}">${escapeHtml(repo.split("/").pop() || repo)}</span><span class="tag info">${count}</span></li>`
              )
              .join("") ||
            '<li style="color: var(--muted)">No repos indexed</li>'
          }
        </ul>
      </div>
      
      <div class="insight-card">
        <h4>Summary Stats</h4>
        <ul class="insight-list">
          <li><span>Total Tool Calls</span><span class="stat-number" style="font-size: 16px;">${totalToolCalls.toLocaleString()}</span></li>
          <li><span>Total Searches</span><span class="stat-number" style="font-size: 16px;">${totalSearches.toLocaleString()}</span></li>
          <li><span>Unique Tools Used</span><span class="stat-number" style="font-size: 16px;">${Object.keys(toolCallsByName).length}</span></li>
          <li><span>Unique Repos</span><span class="stat-number" style="font-size: 16px;">${Object.keys(metrics.documentsByRepo).length}</span></li>
        </ul>
      </div>
    </div>
  `;

  return generateCard(insightsHtml, {
    title: "Insights & Analytics",
    fullWidth: true,
    className: "insights-section",
  });
}

/**
 * Get quality color based on score
 */
function getQualityColor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 40) return "var(--warning)";
  return "var(--error)";
}

/**
 * Get quality message based on score
 */
function getQualityMessage(score: number): string {
  if (score >= 80) return "Excellent! Searches are highly effective.";
  if (score >= 60) return "Good quality. Most searches find relevant content.";
  if (score >= 40) return "Fair quality. Consider improving query patterns.";
  return "Needs improvement. Review indexing and query strategies.";
}

/**
 * Get relevance message based on average score
 */
function getRelevanceMessage(score: number): string {
  if (score >= 70) return "Great match quality overall.";
  if (score >= 50) return "Decent relevance, room for improvement.";
  if (score >= 30) return "Results often miss the mark.";
  return "Consider improving search queries or indexing.";
}
