import { describe, it, expect } from "vitest";
import {
  documentationResources,
  getDocumentation,
} from "../src/resources/docs.js";
import { schemaResources, getSchema } from "../src/resources/schemas.js";

describe("Documentation Resources", () => {
  it("should list all documentation resources", () => {
    expect(documentationResources.length).toBeGreaterThan(0);

    const uris = documentationResources.map((r) => r.uri);
    expect(uris).toContain("midnight://docs/compact-reference");
  });

  it("should get compact reference documentation", async () => {
    const content = await getDocumentation("midnight://docs/compact-reference");

    expect(content).toBeTruthy();
    expect(content).toContain("Compact");
    expect(content).toContain("ledger");
    expect(content).toContain("circuit");
  });

  it("should get tokenomics documentation", async () => {
    const content = await getDocumentation("midnight://docs/tokenomics");

    expect(content).toBeTruthy();
    expect(content).toContain("NIGHT");
    expect(content).toContain("token");
  });
});

describe("Schema Resources", () => {
  it("should list all schema resources", () => {
    expect(schemaResources.length).toBeGreaterThan(0);

    const uris = schemaResources.map((r) => r.uri);
    expect(uris).toContain("midnight://schema/compact-ast");
    expect(uris).toContain("midnight://schema/transaction");
  });

  it("should get compact AST schema", () => {
    const schema = getSchema("midnight://schema/compact-ast");

    expect(schema).toBeTruthy();
    expect(schema).toHaveProperty("$schema");
    expect(schema).toHaveProperty("definitions");
  });

  it("should get transaction schema", () => {
    const schema = getSchema("midnight://schema/transaction");

    expect(schema).toBeTruthy();
    expect(schema).toHaveProperty("properties");
  });

  it("should get proof schema", () => {
    const schema = getSchema("midnight://schema/proof");

    expect(schema).toBeTruthy();
    expect(schema).toHaveProperty("properties");
  });
});
