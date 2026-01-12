/**
 * HTML utility functions for safe rendering
 * Provides XSS protection for user-controlled content
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(str).replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * Escape content for use in HTML attributes
 * More aggressive escaping for attribute contexts
 */
export function escapeAttr(str: string): string {
  if (!str) return "";
  return escapeHtml(str).replace(/`/g, "&#96;").replace(/\//g, "&#47;");
}
