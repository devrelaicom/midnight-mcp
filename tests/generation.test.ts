import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generationTools,
  generationHandlers,
} from "../src/tools/generation/index.js";

describe("Generation Tools", () => {
  describe("Tool Definitions", () => {
    it("should export 3 generation tools", () => {
      expect(generationTools).toHaveLength(3);
    });

    it("should have correct tool names", () => {
      const names = generationTools.map((t) => t.name);
      expect(names).toContain("midnight-generate-contract");
      expect(names).toContain("midnight-review-contract");
      expect(names).toContain("midnight-document-contract");
    });

    it("should have annotations on all tools", () => {
      for (const tool of generationTools) {
        expect(tool.annotations).toBeDefined();
        expect(tool.annotations?.title).toBeDefined();
      }
    });

    it("should have output schemas on all tools", () => {
      for (const tool of generationTools) {
        expect(tool.outputSchema).toBeDefined();
        expect(tool.outputSchema?.type).toBe("object");
      }
    });

    it("should mark AI tools as long-running", () => {
      for (const tool of generationTools) {
        expect(tool.annotations?.longRunningHint).toBe(true);
      }
    });

    it("should mark review and document as read-only", () => {
      const reviewTool = generationTools.find(
        (t) => t.name === "midnight-review-contract"
      );
      const docTool = generationTools.find(
        (t) => t.name === "midnight-document-contract"
      );

      expect(reviewTool?.annotations?.readOnlyHint).toBe(true);
      expect(docTool?.annotations?.readOnlyHint).toBe(true);
    });

    it("should mark generate as NOT read-only", () => {
      const genTool = generationTools.find(
        (t) => t.name === "midnight-generate-contract"
      );
      expect(genTool?.annotations?.readOnlyHint).toBe(false);
    });
  });

  describe("Input Schemas", () => {
    it("generate-contract requires 'requirements'", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-generate-contract"
      );
      expect(tool?.inputSchema.required).toContain("requirements");
    });

    it("review-contract requires 'code'", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-review-contract"
      );
      expect(tool?.inputSchema.required).toContain("code");
    });

    it("document-contract requires 'code'", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-document-contract"
      );
      expect(tool?.inputSchema.required).toContain("code");
    });

    it("generate-contract has optional contractType", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-generate-contract"
      );
      expect(tool?.inputSchema.properties).toHaveProperty("contractType");
      expect(tool?.inputSchema.required).not.toContain("contractType");
    });

    it("document-contract has optional format", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-document-contract"
      );
      expect(tool?.inputSchema.properties).toHaveProperty("format");
      expect(tool?.inputSchema.required).not.toContain("format");
    });
  });

  describe("Handlers (without sampling)", () => {
    it("generate-contract returns samplingAvailable: false when no sampling", async () => {
      const result = await generationHandlers["midnight-generate-contract"]({
        requirements: "Create a simple counter contract",
      });

      expect(result.samplingAvailable).toBe(false);
      expect(result.code).toBe("");
      expect(result.explanation).toContain("Sampling not available");
    });

    it("review-contract returns samplingAvailable: false when no sampling", async () => {
      const result = await generationHandlers["midnight-review-contract"]({
        code: "export ledger counter: Counter;",
      });

      expect(result.samplingAvailable).toBe(false);
      expect(result.summary).toContain("sampling capability");
    });

    it("document-contract returns samplingAvailable: false when no sampling", async () => {
      const result = await generationHandlers["midnight-document-contract"]({
        code: "export ledger counter: Counter;",
      });

      expect(result.samplingAvailable).toBe(false);
      expect(result.documentation).toContain("sampling capability");
    });

    it("document-contract defaults format to markdown", async () => {
      const result = await generationHandlers["midnight-document-contract"]({
        code: "export ledger counter: Counter;",
      });

      expect(result.format).toBe("markdown");
    });
  });

  describe("Output Schema Structure", () => {
    it("generate-contract output matches schema", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-generate-contract"
      );
      const schema = tool?.outputSchema;

      expect(schema?.properties).toHaveProperty("code");
      expect(schema?.properties).toHaveProperty("explanation");
      expect(schema?.properties).toHaveProperty("warnings");
      expect(schema?.properties).toHaveProperty("samplingAvailable");
    });

    it("review-contract output matches schema", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-review-contract"
      );
      const schema = tool?.outputSchema;

      expect(schema?.properties).toHaveProperty("summary");
      expect(schema?.properties).toHaveProperty("issues");
      expect(schema?.properties).toHaveProperty("improvedCode");
      expect(schema?.properties).toHaveProperty("samplingAvailable");
    });

    it("document-contract output matches schema", () => {
      const tool = generationTools.find(
        (t) => t.name === "midnight-document-contract"
      );
      const schema = tool?.outputSchema;

      expect(schema?.properties).toHaveProperty("documentation");
      expect(schema?.properties).toHaveProperty("format");
      expect(schema?.properties).toHaveProperty("samplingAvailable");
    });
  });
});

describe("Generation Handlers Export", () => {
  it("should export all 3 handlers", () => {
    expect(Object.keys(generationHandlers)).toHaveLength(3);
  });

  it("should have matching handler names", () => {
    const handlerNames = Object.keys(generationHandlers);
    const toolNames = generationTools.map((t) => t.name);

    for (const name of toolNames) {
      expect(handlerNames).toContain(name);
    }
  });
});
