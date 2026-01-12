/**
 * Layout components for the dashboard
 * Page structure and reusable layout elements
 */

import { getAllStyles } from "./styles";
import { escapeHtml, escapeAttr } from "./html-utils";

export interface PageOptions {
  title?: string;
  description?: string;
  refreshable?: boolean;
  lastUpdated?: string;
}

/**
 * Generate the full HTML page wrapper
 */
export function generatePageWrapper(
  content: string,
  options: PageOptions = {}
): string {
  const {
    title = "MCP Analytics",
    description = "Midnight MCP Analytics Dashboard",
    refreshable = true,
    lastUpdated,
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description}">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${getAllStyles()}</style>
</head>
<body>
  <div class="container">
    ${generateHeader({ title, refreshable, lastUpdated })}
    ${content}
  </div>
  <script>${getInteractiveScript()}</script>
</body>
</html>`;
}

/**
 * Generate page header
 */
export function generateHeader(options: {
  title: string;
  refreshable?: boolean;
  lastUpdated?: string;
}): string {
  const { title, refreshable = true, lastUpdated } = options;

  const lastUpdatedHtml = lastUpdated
    ? `<span class="last-updated">Live • ${new Date(lastUpdated).toLocaleString()}</span>`
    : `<span class="last-updated">Live</span>`;

  const refreshButton = refreshable
    ? `<button class="btn" onclick="location.reload()" title="Refresh data">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        Refresh
       </button>`
    : "";

  return `
    <header>
      <div class="header-brand">
        <div class="header-logo">🌙</div>
        <h1>${title}</h1>
      </div>
      <div class="header-actions">
        ${lastUpdatedHtml}
        ${refreshButton}
      </div>
    </header>
  `;
}

/**
 * Generate a card wrapper
 */
export function generateCard(
  content: string,
  options: { title?: string; fullWidth?: boolean; className?: string } = {}
): string {
  const { title, fullWidth = false, className = "" } = options;

  const widthClass = fullWidth ? "full-width" : "";
  const titleHtml = title ? `<div class="card-title">${title}</div>` : "";

  return `
    <div class="card ${widthClass} ${className}">
      ${titleHtml}
      ${content}
    </div>
  `;
}

/**
 * Generate a grid layout
 */
export function generateGrid(
  cards: string[],
  options: { columns?: 2 | 3; gap?: string } = {}
): string {
  const { columns = 2 } = options;
  const gridClass = columns === 3 ? "grid grid-3" : "grid";

  return `<div class="${gridClass}">${cards.join("")}</div>`;
}

/**
 * Generate a section with title
 */
export function generateSection(
  content: string,
  options: { title?: string; subtitle?: string; id?: string } = {}
): string {
  const { title, subtitle, id } = options;

  const idAttr = id ? `id="${id}"` : "";
  const titleHtml = title ? `<h2 class="section-title">${title}</h2>` : "";
  const subtitleHtml = subtitle
    ? `<p class="section-subtitle">${subtitle}</p>`
    : "";

  return `
    <section ${idAttr}>
      ${titleHtml}
      ${subtitleHtml}
      ${content}
    </section>
  `;
}

/**
 * Generate empty state
 */
export function generateEmptyState(
  message: string,
  options: { icon?: string; action?: { label: string; onclick: string } } = {}
): string {
  const { icon = "📊", action } = options;

  // Escape onclick to prevent XSS - only allow safe patterns
  const actionHtml = action
    ? `<button class="btn" onclick="${escapeAttr(action.onclick)}">${escapeHtml(action.label)}</button>`
    : "";

  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <p class="empty-message">${escapeHtml(message)}</p>
      ${actionHtml}
    </div>
  `;
}

/**
 * Generate tabs component
 */
export function generateTabs(
  tabs: Array<{ id: string; label: string; content: string }>,
  activeTab?: string
): string {
  const active = activeTab || tabs[0]?.id;

  const tabButtons = tabs
    .map(
      (tab) => `
      <button 
        class="tab-btn ${tab.id === active ? "active" : ""}" 
        data-tab="${tab.id}"
        onclick="switchTab('${tab.id}')"
      >
        ${tab.label}
      </button>
    `
    )
    .join("");

  const tabContents = tabs
    .map(
      (tab) => `
      <div 
        class="tab-content ${tab.id === active ? "active" : ""}" 
        id="tab-${tab.id}"
      >
        ${tab.content}
      </div>
    `
    )
    .join("");

  return `
    <div class="tabs">
      <div class="tab-bar">${tabButtons}</div>
      <div class="tab-panels">${tabContents}</div>
    </div>
  `;
}

/**
 * Get interactive JavaScript for the dashboard
 */
function getInteractiveScript(): string {
  return `
    // Tab switching
    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.querySelector('[data-tab="' + tabId + '"]')?.classList.add('active');
      document.getElementById('tab-' + tabId)?.classList.add('active');
    }
    
    // Auto-refresh every 30 seconds (optional)
    // setInterval(() => location.reload(), 30000);
    
    // Animate metrics on load
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.metric-value').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        setTimeout(() => {
          el.style.transition = 'all 0.3s ease';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, 100);
      });
    });
  `;
}
