/**
 * Dashboard CSS styles
 * Centralized style definitions for the analytics dashboard
 */

/**
 * CSS custom properties (design tokens)
 */
export const cssVariables = `
  :root {
    /* Colors */
    --bg: #111;
    --card: #1c1c1c;
    --card-hover: #252525;
    --border: #333;
    --border-subtle: #222;
    --text: #eee;
    --muted: #888;
    --accent: #6366f1;
    --accent-hover: #818cf8;
    
    /* Status colors */
    --success: #22c55e;
    --success-bg: rgba(34, 197, 94, 0.15);
    --success-bg-strong: rgba(34, 197, 94, 0.2);
    --warning: #eab308;
    --warning-bg: rgba(234, 179, 8, 0.15);
    --warning-bg-strong: rgba(234, 179, 8, 0.2);
    --error: #ef4444;
    --error-bg: rgba(239, 68, 68, 0.15);
    --error-bg-strong: rgba(239, 68, 68, 0.2);
    --info: #3b82f6;
    --info-bg: rgba(59, 130, 246, 0.15);
    
    /* Spacing */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 12px;
    --space-lg: 16px;
    --space-xl: 20px;
    --space-2xl: 24px;
    --space-3xl: 32px;
    
    /* Border radius */
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    
    /* Font sizes */
    --text-xs: 11px;
    --text-sm: 12px;
    --text-base: 13px;
    --text-lg: 14px;
    --text-xl: 18px;
    --text-2xl: 20px;
    --text-3xl: 28px;
    --text-4xl: 32px;
    
    /* Transitions */
    --transition-fast: 0.15s ease;
    --transition-normal: 0.3s ease;
  }
`;

/**
 * Base/reset styles
 */
export const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: var(--space-2xl);
    line-height: 1.5;
    min-height: 100vh;
  }
  .container { max-width: 1200px; margin: 0 auto; }
`;

/**
 * Header styles
 */
export const headerStyles = `
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3xl);
    padding-bottom: var(--space-lg);
    border-bottom: 1px solid var(--border);
  }
  header h1 { font-size: var(--text-2xl); font-weight: 600; }
  header span { color: var(--muted); font-size: var(--text-base); }
  .header-actions { display: flex; align-items: center; gap: var(--space-md); }
`;

/**
 * Button styles
 */
export const buttonStyles = `
  .btn {
    background: var(--card);
    color: var(--text);
    border: 1px solid var(--border);
    padding: var(--space-sm) var(--space-lg);
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: var(--text-base);
    transition: background var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .btn:hover { background: var(--card-hover); }
  .btn-primary {
    background: var(--accent);
    border-color: var(--accent);
  }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-sm { padding: var(--space-xs) var(--space-sm); font-size: var(--text-sm); }
`;

/**
 * Card styles
 */
export const cardStyles = `
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
  }
  .card-title {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--muted);
    margin-bottom: var(--space-lg);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .card-subtitle {
    font-size: var(--text-sm);
    color: var(--muted);
    margin-top: var(--space-xs);
    font-weight: 400;
  }
`;

/**
 * Metrics card styles
 */
export const metricStyles = `
  .metrics {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--space-lg);
    margin-bottom: var(--space-2xl);
  }
  .metric {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
  }
  .metric-value {
    font-size: var(--text-4xl);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .metric-change {
    font-size: var(--text-sm);
    margin-left: var(--space-sm);
  }
  .metric-change.positive { color: var(--success); }
  .metric-change.negative { color: var(--error); }
  .metric-label {
    color: var(--muted);
    font-size: var(--text-sm);
    margin-top: var(--space-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

/**
 * Grid layout styles
 */
export const gridStyles = `
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-lg);
    margin-bottom: var(--space-2xl);
  }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .full-width { grid-column: 1 / -1; }
`;

/**
 * Bar chart styles
 */
export const barChartStyles = `
  .bar-row {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  .bar-row:last-child { margin-bottom: 0; }
  .bar-name {
    width: 100px;
    font-size: var(--text-base);
    color: var(--muted);
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bar-track {
    flex: 1;
    height: 8px;
    background: var(--card-hover);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-sm);
    transition: width var(--transition-normal);
  }
  .bar-fill.success { background: var(--success); }
  .bar-fill.warning { background: var(--warning); }
  .bar-fill.error { background: var(--error); }
  .bar-val {
    width: 50px;
    text-align: right;
    font-size: var(--text-base);
    font-weight: 500;
    margin-left: var(--space-md);
  }
`;

/**
 * Quality score box styles
 */
export const qualityStyles = `
  .quality {
    display: flex;
    gap: var(--space-md);
  }
  .q-box {
    flex: 1;
    text-align: center;
    padding: var(--space-lg) var(--space-sm);
    border-radius: var(--radius-md);
  }
  .q-box.high { background: var(--success-bg); color: var(--success); }
  .q-box.med { background: var(--warning-bg); color: var(--warning); }
  .q-box.low { background: var(--error-bg); color: var(--error); }
  .q-num { font-size: var(--text-3xl); font-weight: 700; }
  .q-label { font-size: var(--text-xs); margin-top: var(--space-xs); opacity: 0.8; }
`;

/**
 * Table styles
 */
export const tableStyles = `
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-base);
  }
  th {
    text-align: left;
    padding: 10px 12px;
    color: var(--muted);
    font-weight: 500;
    border-bottom: 1px solid var(--border);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-subtle);
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(255, 255, 255, 0.02); }
  .cell-truncate {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/**
 * Tag/badge styles
 */
export const tagStyles = `
  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
  }
  .tag.high { background: var(--success-bg-strong); color: var(--success); }
  .tag.med { background: var(--warning-bg-strong); color: var(--warning); }
  .tag.low { background: var(--error-bg-strong); color: var(--error); }
  .tag.info { background: var(--info-bg); color: var(--info); }
`;

/**
 * Tooltip styles
 */
export const tooltipStyles = `
  .has-tooltip { position: relative; cursor: help; }
  .has-tooltip .tooltip {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #2a2a2a;
    color: var(--text);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 400;
    white-space: nowrap;
    z-index: 100;
    border: 1px solid var(--border);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    margin-bottom: var(--space-sm);
    max-width: 280px;
    white-space: normal;
    text-align: left;
    line-height: 1.4;
    transition: opacity var(--transition-fast), visibility var(--transition-fast);
  }
  .has-tooltip .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #2a2a2a;
  }
  .has-tooltip:hover .tooltip { visibility: visible; opacity: 1; }
  .metric-label.has-tooltip { display: inline-flex; align-items: center; gap: var(--space-xs); }
  .info-icon {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--border);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
  }
`;

/**
 * Empty state styles
 */
export const emptyStyles = `
  .empty {
    color: var(--muted);
    text-align: center;
    padding: var(--space-3xl);
    font-size: var(--text-lg);
  }
  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-lg);
    opacity: 0.5;
  }
`;

/**
 * Status indicator styles
 */
export const statusStyles = `
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: var(--space-sm);
  }
  .status-dot.online { background: var(--success); box-shadow: 0 0 8px var(--success); }
  .status-dot.offline { background: var(--error); }
  .status-dot.warning { background: var(--warning); }
`;

/**
 * Insights section styles
 */
export const insightsStyles = `
  .insights-section { margin-top: var(--space-lg); }
  .insights-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-lg);
  }
  .insight-card {
    background: var(--bg);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .insight-card h4 {
    font-size: var(--text-sm);
    color: var(--muted);
    margin-bottom: var(--space-md);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .insight-card p {
    font-size: var(--text-sm);
    color: var(--muted);
    line-height: 1.5;
  }
  .insight-details {
    margin-top: var(--space-md);
  }
  .insight-stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    width: 100%;
  }
  .insight-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .stat-number {
    font-size: var(--text-3xl);
    font-weight: 700;
    color: var(--text);
  }
  .stat-desc {
    font-size: var(--text-xs);
    color: var(--muted);
    margin-top: var(--space-xs);
  }
  .insight-list {
    list-style: none;
    width: 100%;
    text-align: left;
  }
  .insight-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--border-subtle);
  }
  .insight-list li:last-child { border-bottom: none; }
  .insight-list li span:first-child {
    color: var(--text);
    font-size: var(--text-sm);
  }
  .donut-chart {
    margin-bottom: var(--space-sm);
  }
  
  @media (max-width: 1024px) {
    .insights-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .insights-grid { grid-template-columns: 1fr; }
    .insight-card { padding: var(--space-md); }
  }
`;

/**
 * Tab styles
 */
export const tabStyles = `
  .tabs { margin-bottom: var(--space-2xl); }
  .tab-bar {
    display: flex;
    gap: var(--space-xs);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-lg);
  }
  .tab-btn {
    background: none;
    border: none;
    color: var(--muted);
    padding: var(--space-sm) var(--space-lg);
    font-size: var(--text-base);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all var(--transition-fast);
    margin-bottom: -1px;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
`;

/**
 * Responsive breakpoints
 */
export const responsiveStyles = `
  @media (max-width: 1200px) {
    .metrics { grid-template-columns: repeat(3, 1fr); }
  }
  
  @media (max-width: 1024px) {
    .metrics { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: 1fr 1fr; }
  }
  
  @media (max-width: 768px) {
    body { padding: var(--space-lg); }
    header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-md);
    }
    header h1 { font-size: var(--text-xl); }
    header > div {
      display: flex;
      align-items: center;
      width: 100%;
      justify-content: space-between;
    }
    .metrics, .grid, .grid-3 { grid-template-columns: 1fr; }
    .metric { padding: var(--space-lg); }
    .metric-value { font-size: 26px; }
    .card { padding: var(--space-lg); }
    .quality { flex-wrap: wrap; }
    .q-box { min-width: calc(50% - 6px); flex: 0 0 auto; }
    .q-num { font-size: 22px; }
    .bar-name { width: 70px; font-size: var(--text-sm); }
    .bar-val { width: 35px; font-size: var(--text-sm); margin-left: var(--space-sm); }
    table {
      font-size: var(--text-sm);
      display: block;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    th, td { padding: var(--space-sm); white-space: nowrap; }
    .cell-truncate { max-width: 150px !important; }
  }
  
  @media (max-width: 480px) {
    body { padding: var(--space-md); }
    header h1 { font-size: var(--text-lg); }
    .btn { padding: var(--space-xs) var(--space-md); font-size: var(--text-sm); }
    .metric-value { font-size: 22px; }
    .metric-label { font-size: var(--text-xs); }
    .card-title { font-size: var(--text-sm); margin-bottom: var(--space-md); }
    .q-box { min-width: 100%; padding: var(--space-md) var(--space-sm); }
    .q-num { font-size: 20px; }
    .bar-name { width: 60px; font-size: var(--text-xs); }
    .bar-track { height: 6px; }
    .bar-val { width: 30px; font-size: var(--text-xs); }
    .quality { flex-direction: column; gap: var(--space-sm); }
  }
`;

/**
 * Get all dashboard styles combined
 */
export function getAllStyles(): string {
  return [
    cssVariables,
    baseStyles,
    headerStyles,
    buttonStyles,
    cardStyles,
    metricStyles,
    gridStyles,
    barChartStyles,
    qualityStyles,
    tableStyles,
    tagStyles,
    tooltipStyles,
    emptyStyles,
    statusStyles,
    insightsStyles,
    tabStyles,
    responsiveStyles,
  ].join("\n");
}
