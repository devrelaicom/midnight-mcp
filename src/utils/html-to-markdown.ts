/**
 * HTML-to-markdown extraction for Docusaurus SSG pages.
 * Uses node-html-parser for DOM traversal and turndown for conversion.
 */

import { parse as parseHtml } from "node-html-parser";
import TurndownService from "turndown";

export interface ExtractedContent {
  title: string;
  content: string;
  headings: Array<{ level: number; text: string; id: string }>;
  lastUpdated?: string;
}

/**
 * Selectors for elements that should be stripped before markdown conversion.
 */
const SELECTORS_TO_REMOVE = ["script", "style", "svg", "nav", "footer", ".hash-link", "button"];

/**
 * Create a configured TurndownService instance.
 * Stateless and reusable — configured once at module level.
 */
function createTurndownService(): TurndownService {
  return new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
  });
}

const turndown = createTurndownService();

/**
 * Extract readable markdown content from Docusaurus SSG HTML.
 * Strips navigation, scripts, styles and extracts main content.
 */
export function extractContentFromHtml(html: string, extractSection?: string): ExtractedContent {
  const root = parseHtml(html);

  // --- Phase A: Extract metadata ---

  const titleEl = root.querySelector("title");
  const title = titleEl ? titleEl.textContent.replace(" | Midnight Docs", "").trim() : "Unknown";

  const timeEl = root.querySelector('time[itemprop="dateModified"]');
  const lastUpdated = timeEl?.getAttribute("datetime") ?? undefined;

  const article = root.querySelector("article") ?? root;

  // --- Phase B: Extract headings (before element removal) ---

  const headings: ExtractedContent["headings"] = [];
  for (const heading of article.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const id = heading.getAttribute("id");
    if (!id) continue;
    const text = heading.textContent.replace(/\u200B/g, "").trim();
    if (text) {
      const level = parseInt(heading.tagName.charAt(1));
      headings.push({ level, text, id });
    }
  }

  // --- Phase C: Remove unwanted elements and convert to markdown ---

  for (const selector of SELECTORS_TO_REMOVE) {
    for (const el of article.querySelectorAll(selector)) {
      el.remove();
    }
  }

  let content = turndown.turndown(article.innerHTML);

  // Collapse excessive blank lines
  content = content.replace(/\n{3,}/g, "\n\n").trim();

  // --- Phase D: Section extraction ---

  if (extractSection) {
    const sectionLower = extractSection.toLowerCase();
    const lines = content.split("\n");
    const result: string[] = [];
    let inSection = false;
    let sectionLevel = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch?.[1] && headerMatch[2]) {
        const level = headerMatch[1].length;
        const headerText = headerMatch[2].toLowerCase();

        if (headerText.includes(sectionLower)) {
          inSection = true;
          sectionLevel = level;
          result.push(line);
        } else if (inSection && level <= sectionLevel) {
          break;
        } else if (inSection) {
          result.push(line);
        }
      } else if (inSection) {
        result.push(line);
      }
    }

    if (result.length > 0) {
      content = result.join("\n").trim();
    }
  }

  return { title, content, headings, lastUpdated };
}
