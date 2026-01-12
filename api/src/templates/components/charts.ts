/**
 * Chart components for the dashboard
 * Reusable bar charts and visualizations
 */

import { escapeHtml, escapeAttr } from "./html-utils";

export interface BarChartOptions {
  maxItems?: number;
  showPercentage?: boolean;
  colorScheme?: "accent" | "status";
  emptyMessage?: string;
}

/**
 * Generate a horizontal bar chart from key-value data
 */
export function generateBarChart(
  data: Record<string, number>,
  total: number,
  options: BarChartOptions = {}
): string {
  const {
    maxItems,
    showPercentage = false,
    colorScheme = "accent",
    emptyMessage = "—",
  } = options;

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return `<p class="empty">${emptyMessage}</p>`;
  }

  let sortedEntries = entries.sort((a, b) => b[1] - a[1]);
  if (maxItems) {
    sortedEntries = sortedEntries.slice(0, maxItems);
  }

  return sortedEntries
    .map(([name, count]) => {
      const percentage = total > 0 ? (count / total) * 100 : 0;
      const displayValue = showPercentage
        ? `${percentage.toFixed(0)}%`
        : count.toString();
      const fillClass = getBarFillClass(percentage, colorScheme);

      return `
        <div class="bar-row">
          <span class="bar-name" title="${escapeAttr(name)}">${escapeHtml(name)}</span>
          <div class="bar-track">
            <div class="bar-fill ${fillClass}" style="width: ${percentage}%"></div>
          </div>
          <span class="bar-val">${displayValue}</span>
        </div>
      `;
    })
    .join("");
}

/**
 * Generate repository chart (relative to max value)
 */
export function generateRepoChart(
  documentsByRepo: Record<string, number>,
  options: BarChartOptions = {}
): string {
  const { maxItems = 5, emptyMessage = "No repositories indexed" } = options;

  const entries = Object.entries(documentsByRepo);
  if (entries.length === 0) {
    return `<p class="empty">${emptyMessage}</p>`;
  }

  const maxValue = Math.max(...entries.map(([, count]) => count));

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([repo, count]) => {
      const percentage = maxValue > 0 ? (count / maxValue) * 100 : 0;
      const displayName = repo.split("/").pop() || repo;

      return `
        <div class="bar-row">
          <span class="bar-name" title="${escapeAttr(repo)}">${escapeHtml(displayName)}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="bar-val">${count.toLocaleString()}</span>
        </div>
      `;
    })
    .join("");
}

/**
 * Generate quality score boxes
 */
export function generateQualityBoxes(scoreDistribution: {
  high: number;
  medium: number;
  low: number;
}): string {
  return `
    <div class="quality">
      <div class="q-box high has-tooltip">
        <div class="q-num">${scoreDistribution.high}</div>
        <div class="q-label">High ≥70%</div>
        <span class="tooltip">Queries with ≥70% relevance score. These found highly relevant content.</span>
      </div>
      <div class="q-box med has-tooltip">
        <div class="q-num">${scoreDistribution.medium}</div>
        <div class="q-label">Medium 40-69%</div>
        <span class="tooltip">Queries with 40-69% relevance. Results were somewhat relevant but could be improved.</span>
      </div>
      <div class="q-box low has-tooltip">
        <div class="q-num">${scoreDistribution.low}</div>
        <div class="q-label">Low &lt;40%</div>
        <span class="tooltip">Queries with &lt;40% relevance. May indicate missing content or unclear queries.</span>
      </div>
    </div>
  `;
}

/**
 * Generate a donut/ring chart for percentages
 */
export function generateDonutChart(
  percentage: number,
  label: string,
  options: { size?: number; strokeWidth?: number; color?: string } = {}
): string {
  const { size = 120, strokeWidth = 8, color = "var(--accent)" } = options;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return `
    <div class="donut-chart" style="width: ${size}px; height: ${size}px; position: relative;">
      <svg width="${size}" height="${size}" style="transform: rotate(-90deg);">
        <circle
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          fill="none"
          stroke="var(--border)"
          stroke-width="${strokeWidth}"
        />
        <circle
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          fill="none"
          stroke="${color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          stroke-linecap="round"
          style="transition: stroke-dashoffset 0.5s ease;"
        />
      </svg>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
        <div style="font-size: 24px; font-weight: 700;">${percentage}%</div>
        <div style="font-size: 11px; color: var(--muted);">${label}</div>
      </div>
    </div>
  `;
}

/**
 * Generate a sparkline chart (mini trend line)
 */
export function generateSparkline(
  data: number[],
  options: { width?: number; height?: number; color?: string } = {}
): string {
  const { width = 100, height = 30, color = "var(--accent)" } = options;

  if (data.length < 2) {
    return `<div style="width: ${width}px; height: ${height}px;"></div>`;
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return `
    <svg width="${width}" height="${height}" style="overflow: visible;">
      <polyline
        points="${points}"
        fill="none"
        stroke="${color}"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

/**
 * Generate progress bar
 */
export function generateProgressBar(
  current: number,
  max: number,
  options: { showLabel?: boolean; height?: number } = {}
): string {
  const { showLabel = true, height = 8 } = options;
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const colorClass =
    percentage >= 70 ? "success" : percentage >= 40 ? "warning" : "error";

  return `
    <div class="progress-container">
      <div class="bar-track" style="height: ${height}px;">
        <div class="bar-fill ${colorClass}" style="width: ${percentage}%"></div>
      </div>
      ${showLabel ? `<span class="bar-val">${percentage.toFixed(0)}%</span>` : ""}
    </div>
  `;
}

/**
 * Helper to determine bar fill color class
 */
function getBarFillClass(
  percentage: number,
  scheme: "accent" | "status"
): string {
  if (scheme === "accent") return "";
  if (percentage >= 70) return "success";
  if (percentage >= 40) return "warning";
  return "error";
}
