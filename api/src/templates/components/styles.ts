/**
 * Dashboard CSS styles
 * Centralized style definitions for the analytics dashboard
 */

/**
 * CSS custom properties (design tokens)
 */
export const cssVariables = `
  :root {
    /* Colors - Rich dark theme */
    --bg: #0a0a0f;
    --bg-gradient: linear-gradient(135deg, #0a0a0f 0%, #13131a 100%);
    --card: rgba(24, 24, 32, 0.8);
    --card-solid: #18181f;
    --card-hover: rgba(32, 32, 42, 0.9);
    --card-border: rgba(255, 255, 255, 0.06);
    --border: rgba(255, 255, 255, 0.08);
    --border-subtle: rgba(255, 255, 255, 0.04);
    --text: #f4f4f5;
    --text-secondary: #a1a1aa;
    --muted: #71717a;
    
    /* Accent - Vibrant indigo/purple */
    --accent: #8b5cf6;
    --accent-light: #a78bfa;
    --accent-dark: #7c3aed;
    --accent-hover: #818cf8;
    --accent-glow: rgba(139, 92, 246, 0.4);
    --accent-bg: rgba(139, 92, 246, 0.1);
    
    /* Status colors - Refined */
    --success: #10b981;
    --success-light: #34d399;
    --success-bg: rgba(16, 185, 129, 0.12);
    --success-bg-strong: rgba(16, 185, 129, 0.2);
    --success-glow: rgba(16, 185, 129, 0.3);
    
    --warning: #f59e0b;
    --warning-light: #fbbf24;
    --warning-bg: rgba(245, 158, 11, 0.12);
    --warning-bg-strong: rgba(245, 158, 11, 0.2);
    --warning-glow: rgba(245, 158, 11, 0.3);
    
    --error: #ef4444;
    --error-light: #f87171;
    --error-bg: rgba(239, 68, 68, 0.12);
    --error-bg-strong: rgba(239, 68, 68, 0.2);
    --error-glow: rgba(239, 68, 68, 0.3);
    
    --info: #3b82f6;
    --info-light: #60a5fa;
    --info-bg: rgba(59, 130, 246, 0.12);
    
    /* Spacing */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 12px;
    --space-lg: 16px;
    --space-xl: 20px;
    --space-2xl: 24px;
    --space-3xl: 32px;
    --space-4xl: 48px;
    
    /* Border radius */
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 20px;
    --radius-full: 9999px;
    
    /* Font sizes */
    --text-xs: 11px;
    --text-sm: 12px;
    --text-base: 14px;
    --text-lg: 16px;
    --text-xl: 18px;
    --text-2xl: 24px;
    --text-3xl: 30px;
    --text-4xl: 36px;
    
    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
    --shadow-glow: 0 0 40px var(--accent-glow);
    
    /* Transitions */
    --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-normal: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

/**
 * Base/reset styles
 */
export const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg);
    background-image: var(--bg-gradient);
    color: var(--text);
    padding: var(--space-3xl);
    line-height: 1.6;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: 
      linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px);
    background-size: 50px 50px;
    pointer-events: none;
    z-index: -1;
  }
  .container { max-width: 1400px; margin: 0 auto; position: relative; }
  ::selection { background: var(--accent); color: white; }
`;

/**
 * Header styles
 */
export const headerStyles = `
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-4xl);
    padding-bottom: var(--space-2xl);
    border-bottom: 1px solid var(--border);
  }
  .header-brand { display: flex; align-items: center; gap: var(--space-md); }
  .header-logo {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow: var(--shadow-glow);
  }
  header h1 { 
    font-size: var(--text-2xl); 
    font-weight: 700;
    background: linear-gradient(135deg, var(--text) 0%, var(--text-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header-actions { display: flex; align-items: center; gap: var(--space-lg); }
  .last-updated {
    color: var(--muted);
    font-size: var(--text-sm);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .last-updated::before {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--success);
    border-radius: 50%;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.1); }
  }
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
    font-size: var(--text-sm);
    font-weight: 500;
    transition: all var(--transition-fast);
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    backdrop-filter: blur(10px);
  }
  .btn:hover { 
    background: var(--card-hover);
    border-color: var(--accent);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
  .btn:active { transform: translateY(0); }
  .btn-primary {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%);
    border-color: transparent;
    color: white;
  }
  .btn-primary:hover { box-shadow: var(--shadow-glow); border-color: transparent; }
  .btn-sm { padding: var(--space-xs) var(--space-sm); font-size: var(--text-sm); }
  .btn svg { width: 16px; height: 16px; }
`;

/**
 * Card styles
 */
export const cardStyles = `
  .card {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-lg);
    padding: var(--space-2xl);
    backdrop-filter: blur(20px);
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  }
  .card:hover {
    border-color: rgba(139, 92, 246, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transform: translateY(-2px);
  }
  .card-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: var(--space-xl);
    text-transform: uppercase;
    letter-spacing: 1px;
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .card-title::before {
    content: '';
    width: 3px;
    height: 14px;
    background: var(--accent);
    border-radius: var(--radius-full);
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
    margin-bottom: var(--space-3xl);
  }
  .metric {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-lg);
    padding: var(--space-2xl);
    backdrop-filter: blur(20px);
    transition: all var(--transition-normal);
    position: relative;
    overflow: hidden;
  }
  .metric::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), var(--accent-light));
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .metric:hover::before { opacity: 1; }
  .metric:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg), var(--shadow-glow);
    border-color: rgba(139, 92, 246, 0.3);
  }
  .metric-value {
    font-size: var(--text-4xl);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    background: linear-gradient(135deg, var(--text) 0%, var(--text-secondary) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.2;
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
    margin-top: var(--space-sm);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 500;
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
    margin-bottom: var(--space-3xl);
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
    margin-bottom: var(--space-md);
    padding: var(--space-sm) 0;
    transition: all var(--transition-fast);
    border-radius: var(--radius-sm);
  }
  .bar-row:hover {
    background: rgba(255, 255, 255, 0.02);
    padding-left: var(--space-sm);
  }
  .bar-row:last-child { margin-bottom: 0; }
  .bar-name {
    width: 100px;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }
  .bar-track {
    flex: 1;
    height: 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin: 0 var(--space-md);
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent) 0%, var(--accent-light) 100%);
    border-radius: var(--radius-full);
    transition: width var(--transition-slow);
  }
  .bar-fill.success { background: linear-gradient(90deg, var(--success) 0%, var(--success-light) 100%); }
  .bar-fill.warning { background: linear-gradient(90deg, var(--warning) 0%, var(--warning-light) 100%); }
  .bar-fill.error { background: linear-gradient(90deg, var(--error) 0%, var(--error-light) 100%); }
  .bar-val {
    width: 50px;
    text-align: right;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
`;

/**
 * Quality score box styles
 */
export const qualityStyles = `
  .quality { display: flex; gap: var(--space-md); }
  .q-box {
    flex: 1;
    text-align: center;
    padding: var(--space-xl) var(--space-lg);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }
  .q-box:hover { transform: scale(1.02); }
  .q-box.high { 
    background: var(--success-bg); 
    color: var(--success-light);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  .q-box.high:hover { box-shadow: 0 0 30px var(--success-glow); }
  .q-box.med { 
    background: var(--warning-bg); 
    color: var(--warning-light);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }
  .q-box.med:hover { box-shadow: 0 0 30px var(--warning-glow); }
  .q-box.low { 
    background: var(--error-bg); 
    color: var(--error-light);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
  .q-box.low:hover { box-shadow: 0 0 30px var(--error-glow); }
  .q-num { font-size: var(--text-3xl); font-weight: 800; line-height: 1; }
  .q-label { 
    font-size: var(--text-xs); 
    margin-top: var(--space-sm); 
    opacity: 0.8;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
`;

/**
 * Table styles
 */
export const tableStyles = `
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: var(--text-sm);
  }
  th {
    text-align: left;
    padding: var(--space-md) var(--space-lg);
    color: var(--muted);
    font-weight: 600;
    border-bottom: 1px solid var(--border);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 1px;
    background: rgba(0, 0, 0, 0.2);
  }
  th:first-child { border-radius: var(--radius-md) 0 0 0; }
  th:last-child { border-radius: 0 var(--radius-md) 0 0; }
  td {
    padding: var(--space-md) var(--space-lg);
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { 
    background: rgba(139, 92, 246, 0.05);
    color: var(--text);
  }
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
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  .tag.high { background: var(--success-bg); color: var(--success-light); border: 1px solid rgba(16, 185, 129, 0.3); }
  .tag.med { background: var(--warning-bg); color: var(--warning-light); border: 1px solid rgba(245, 158, 11, 0.3); }
  .tag.low { background: var(--error-bg); color: var(--error-light); border: 1px solid rgba(239, 68, 68, 0.3); }
  .tag.info { background: var(--accent-bg); color: var(--accent-light); border: 1px solid rgba(139, 92, 246, 0.3); }
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
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    background: var(--card-solid);
    color: var(--text);
    padding: var(--space-md) var(--space-lg);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 400;
    z-index: 100;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    max-width: 280px;
    text-align: left;
    line-height: 1.5;
    transition: all var(--transition-fast);
    backdrop-filter: blur(20px);
  }
  .has-tooltip .tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 8px solid transparent;
    border-top-color: var(--card-solid);
  }
  .has-tooltip:hover .tooltip { 
    visibility: visible; 
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  .metric-label.has-tooltip { display: inline-flex; align-items: center; gap: var(--space-xs); }
  .info-icon {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--border);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
    transition: all var(--transition-fast);
  }
  .has-tooltip:hover .info-icon { background: var(--accent); color: white; }
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
    background: rgba(0, 0, 0, 0.3);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: all var(--transition-normal);
    border: 1px solid var(--border-subtle);
  }
  .insight-card:hover {
    background: rgba(139, 92, 246, 0.05);
    border-color: rgba(139, 92, 246, 0.2);
    transform: translateY(-2px);
  }
  .insight-card h4 {
    font-size: var(--text-xs);
    color: var(--muted);
    margin-bottom: var(--space-lg);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 600;
  }
  .insight-card p { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; }
  .insight-details { margin-top: var(--space-lg); }
  .insight-stats { display: flex; flex-direction: column; gap: var(--space-lg); width: 100%; }
  .insight-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-md);
    background: rgba(255, 255, 255, 0.02);
    border-radius: var(--radius-md);
  }
  .stat-number { font-size: var(--text-2xl); font-weight: 800; color: var(--text); line-height: 1; }
  .stat-desc { font-size: var(--text-xs); color: var(--muted); margin-top: var(--space-xs); text-transform: uppercase; }
  .insight-list { list-style: none; width: 100%; text-align: left; }
  .insight-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md) var(--space-sm);
    border-bottom: 1px solid var(--border-subtle);
    transition: all var(--transition-fast);
  }
  .insight-list li:hover { background: rgba(255, 255, 255, 0.02); padding-left: var(--space-md); }
  .insight-list li:last-child { border-bottom: none; }
  .insight-list li span:first-child { color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500; }
  .donut-chart { margin-bottom: var(--space-md); filter: drop-shadow(0 0 20px var(--accent-glow)); }
  
  @media (max-width: 1200px) { .insights-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 768px) { .insights-grid { grid-template-columns: 1fr; } }
`;

/**
 * Tab styles
 */
export const tabStyles = `
  .tabs { margin-bottom: var(--space-3xl); }
  .tab-bar {
    display: flex;
    gap: var(--space-xs);
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-xl);
  }
  .tab-btn {
    background: none;
    border: none;
    color: var(--muted);
    padding: var(--space-md) var(--space-xl);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all var(--transition-fast);
    margin-bottom: -1px;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--accent-light); border-bottom-color: var(--accent); }
  .tab-content { display: none; }
  .tab-content.active { display: block; animation: fadeIn 0.3s ease; }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

/**
 * Responsive breakpoints
 */
export const responsiveStyles = `
  @media (max-width: 1400px) { .metrics { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 1200px) { .metrics { grid-template-columns: repeat(2, 1fr); } .grid-3 { grid-template-columns: 1fr 1fr; } }
  
  @media (max-width: 768px) {
    body { padding: var(--space-lg); }
    header { flex-direction: column; align-items: flex-start; gap: var(--space-lg); }
    header h1 { font-size: var(--text-xl); }
    .header-actions { width: 100%; justify-content: space-between; }
    .header-brand { width: 100%; }
    .metrics, .grid, .grid-3 { grid-template-columns: 1fr; }
    .metric { padding: var(--space-xl); }
    .metric-value { font-size: var(--text-3xl); }
    .card { padding: var(--space-xl); }
    .quality { flex-wrap: wrap; }
    .q-box { min-width: calc(50% - 8px); }
    .q-num { font-size: var(--text-2xl); }
    .bar-name { width: 80px; font-size: var(--text-xs); }
    .bar-val { width: 40px; font-size: var(--text-xs); }
    table { font-size: var(--text-xs); display: block; overflow-x: auto; }
    th, td { padding: var(--space-sm) var(--space-md); white-space: nowrap; }
  }
  
  @media (max-width: 480px) {
    body { padding: var(--space-md); }
    .metric-value { font-size: var(--text-2xl); }
    .metric-label { font-size: var(--text-xs); }
    .q-box { min-width: 100%; padding: var(--space-lg); }
    .quality { flex-direction: column; gap: var(--space-sm); }
    .bar-track { height: 8px; }
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
