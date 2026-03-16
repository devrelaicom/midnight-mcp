import { describe, it, expect } from "vitest";
import { extractContentFromHtml } from "../src/utils/html-to-markdown.js";

/**
 * Helper to wrap content in a minimal Docusaurus-like HTML page.
 */
function docPage(opts: { title?: string; lastUpdated?: string; articleHtml: string }): string {
  const titleTag = opts.title ? `<title>${opts.title} | Midnight Docs</title>` : "";
  const timeTag = opts.lastUpdated
    ? `<time datetime="${opts.lastUpdated}" itemprop="dateModified">${opts.lastUpdated}</time>`
    : "";
  return `<html><head>${titleTag}</head><body>${timeTag}<article>${opts.articleHtml}</article></body></html>`;
}

describe("extractContentFromHtml", () => {
  // ----------------------------------------------------------------
  // Title extraction
  // ----------------------------------------------------------------
  describe("title extraction", () => {
    it("extracts title and strips Midnight Docs suffix", () => {
      const html = docPage({ title: "Getting Started", articleHtml: "<p>Hello</p>" });
      const result = extractContentFromHtml(html);
      expect(result.title).toBe("Getting Started");
    });

    it("handles title without suffix", () => {
      const html =
        "<html><head><title>Plain Title</title></head><body><article><p>Hi</p></article></body></html>";
      const result = extractContentFromHtml(html);
      expect(result.title).toBe("Plain Title");
    });

    it('returns "Unknown" when title is missing', () => {
      const html = "<html><body><article><p>No title</p></article></body></html>";
      const result = extractContentFromHtml(html);
      expect(result.title).toBe("Unknown");
    });
  });

  // ----------------------------------------------------------------
  // Last updated extraction
  // ----------------------------------------------------------------
  describe("lastUpdated extraction", () => {
    it("extracts datetime from time element", () => {
      const html = docPage({
        title: "Test",
        lastUpdated: "2025-06-15T10:00:00Z",
        articleHtml: "<p>Content</p>",
      });
      const result = extractContentFromHtml(html);
      expect(result.lastUpdated).toBe("2025-06-15T10:00:00Z");
    });

    it("returns undefined when time element is missing", () => {
      const html = docPage({ title: "Test", articleHtml: "<p>Content</p>" });
      const result = extractContentFromHtml(html);
      expect(result.lastUpdated).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // Heading extraction
  // ----------------------------------------------------------------
  describe("heading extraction", () => {
    it("extracts headings with id attributes", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `
          <h2 id="intro">Introduction</h2>
          <p>Some text</p>
          <h3 id="details">Details</h3>
          <p>More text</p>
        `,
      });
      const result = extractContentFromHtml(html);
      expect(result.headings).toEqual([
        { level: 2, text: "Introduction", id: "intro" },
        { level: 3, text: "Details", id: "details" },
      ]);
    });

    it("strips zero-width spaces from heading text", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<h2 id="zws">Hello\u200BWorld</h2>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.headings[0]?.text).toBe("HelloWorld");
    });

    it("extracts clean text from headings with nested HTML", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<h2 id="nested"><code>compact</code> Language</h2>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.headings[0]?.text).toBe("compact Language");
    });

    it("skips headings without id", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `
          <h2>No ID Heading</h2>
          <h2 id="with-id">With ID</h2>
        `,
      });
      const result = extractContentFromHtml(html);
      expect(result.headings).toHaveLength(1);
      expect(result.headings[0]?.id).toBe("with-id");
    });

    it("returns empty array when no headings exist", () => {
      const html = docPage({ title: "Test", articleHtml: "<p>Just a paragraph</p>" });
      const result = extractContentFromHtml(html);
      expect(result.headings).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // Element removal
  // ----------------------------------------------------------------
  describe("element removal", () => {
    it("removes script tags", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>Before</p><script>alert("xss")</script><p>After</p>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).not.toContain("alert");
      expect(result.content).toContain("Before");
      expect(result.content).toContain("After");
    });

    it("removes style tags", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>Visible</p><style>.hidden { display: none; }</style>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).not.toContain("display");
      expect(result.content).toContain("Visible");
    });

    it("removes SVG elements", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>Text</p><svg viewBox="0 0 24 24"><path d="M12 0"/></svg>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).not.toContain("viewBox");
      expect(result.content).not.toContain("path");
    });

    it("removes nav elements", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<nav class="breadcrumbs"><a href="/">Home</a></nav><p>Content</p>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).not.toContain("breadcrumbs");
    });

    it("removes footer elements", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>Content</p><footer><a href="/edit">Edit</a></footer>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).not.toContain("Edit");
    });

    it("removes button elements", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>Content</p><button>Copy</button>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).not.toContain("Copy");
    });

    it("removes hash-link anchors", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<h2 id="faq">FAQ<a class="hash-link" href="#faq">#</a></h2>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).not.toContain("hash-link");
      expect(result.content).toContain("FAQ");
    });
  });

  // ----------------------------------------------------------------
  // Markdown conversion
  // ----------------------------------------------------------------
  describe("markdown conversion", () => {
    it("converts headings to atx style", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<h1 id="t">Title</h1><h2 id="s">Subtitle</h2><h3 id="d">Detail</h3>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toContain("# Title");
      expect(result.content).toContain("## Subtitle");
      expect(result.content).toContain("### Detail");
    });

    it("converts paragraphs to plain text", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>First paragraph</p><p>Second paragraph</p>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toContain("First paragraph");
      expect(result.content).toContain("Second paragraph");
    });

    it("converts unordered lists", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<ul><li>Item one</li><li>Item two</li></ul>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toMatch(/-\s+Item one/);
      expect(result.content).toMatch(/-\s+Item two/);
    });

    it("converts fenced code blocks with language", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<pre><code class="language-typescript">const x = 1;</code></pre>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toContain("```typescript");
      expect(result.content).toContain("const x = 1;");
      expect(result.content).toContain("```");
    });

    it("converts inline code", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>Use the <code>compact</code> compiler</p>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toContain("`compact`");
    });

    it("converts links to markdown format", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>Visit <a href="https://example.com">Example</a></p>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toContain("[Example](https://example.com)");
    });

    it("converts bold and italic", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p><strong>Bold</strong> and <em>italic</em></p>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toContain("**Bold**");
      expect(result.content).toContain("_italic_");
    });

    it("decodes HTML entities", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>A &amp; B &lt; C &gt; D &quot;E&quot;</p>`,
      });
      const result = extractContentFromHtml(html);
      expect(result.content).toContain('A & B < C > D "E"');
    });

    it("collapses excessive blank lines", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `<p>First</p><p></p><p></p><p></p><p>Second</p>`,
      });
      const result = extractContentFromHtml(html);
      // Should not have more than 2 consecutive newlines
      expect(result.content).not.toMatch(/\n{3,}/);
    });
  });

  // ----------------------------------------------------------------
  // Section extraction
  // ----------------------------------------------------------------
  describe("section extraction", () => {
    const multiSectionHtml = docPage({
      title: "Docs",
      articleHtml: `
        <h2 id="intro">Introduction</h2>
        <p>Intro content here.</p>
        <h2 id="install">Installation</h2>
        <p>Install content here.</p>
        <h3 id="prereqs">Prerequisites</h3>
        <p>Node.js required.</p>
        <h2 id="usage">Usage</h2>
        <p>Usage content here.</p>
      `,
    });

    it("extracts a matching section", () => {
      const result = extractContentFromHtml(multiSectionHtml, "Installation");
      expect(result.content).toContain("Installation");
      expect(result.content).toContain("Install content here");
      expect(result.content).toContain("Prerequisites");
      expect(result.content).not.toContain("Usage content here");
      expect(result.content).not.toContain("Intro content here");
    });

    it("is case insensitive", () => {
      const result = extractContentFromHtml(multiSectionHtml, "installation");
      expect(result.content).toContain("Install content here");
    });

    it("respects heading hierarchy — stops at same level", () => {
      const result = extractContentFromHtml(multiSectionHtml, "Installation");
      // Should include h3 subsection but stop at next h2
      expect(result.content).toContain("Prerequisites");
      expect(result.content).not.toContain("Usage content here");
    });

    it("returns full content when section is not found", () => {
      const result = extractContentFromHtml(multiSectionHtml, "Nonexistent");
      expect(result.content).toContain("Intro content here");
      expect(result.content).toContain("Install content here");
      expect(result.content).toContain("Usage content here");
    });

    it("handles h5/h6 level headings", () => {
      const html = docPage({
        title: "Test",
        articleHtml: `
          <h5 id="deep">Deep Section</h5>
          <p>Deep content.</p>
          <h5 id="next">Next Section</h5>
          <p>Next content.</p>
        `,
      });
      const result = extractContentFromHtml(html, "Deep Section");
      expect(result.content).toContain("Deep content");
      expect(result.content).not.toContain("Next content");
    });
  });

  // ----------------------------------------------------------------
  // Edge cases
  // ----------------------------------------------------------------
  describe("edge cases", () => {
    it("handles HTML without article element — falls back to full document", () => {
      const html = "<html><head><title>Test</title></head><body><p>Content</p></body></html>";
      const result = extractContentFromHtml(html);
      expect(result.content).toContain("Content");
    });

    it("handles empty article", () => {
      const html = docPage({ title: "Empty", articleHtml: "" });
      const result = extractContentFromHtml(html);
      expect(result.content).toBe("");
      expect(result.headings).toEqual([]);
    });
  });
});
