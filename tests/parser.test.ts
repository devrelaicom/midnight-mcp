import { describe, it, expect } from "vitest";
import {
  parseCompactFile,
  parseTypeScriptFile,
  parseMarkdownFile,
} from "../src/pipeline/parser.js";

describe("Compact Parser", () => {
  it("should parse ledger declarations", () => {
    const code = `
ledger {
  counter: Counter;
  @private
  secretValue: Field;
}
    `;

    const result = parseCompactFile("test.compact", code);

    expect(result.metadata.hasLedger).toBe(true);
    expect(
      result.codeUnits.filter((u) => u.type === "ledger").length
    ).toBeGreaterThan(0);
  });

  it("should parse circuit definitions", () => {
    const code = `
export circuit increment(amount: Field): Field {
  ledger.counter.increment(amount);
  return ledger.counter.read();
}
    `;

    const result = parseCompactFile("test.compact", code);

    expect(result.metadata.hasCircuits).toBe(true);
    const circuits = result.codeUnits.filter((u) => u.type === "circuit");
    expect(circuits.length).toBe(1);
    expect(circuits[0].name).toBe("increment");
    expect(circuits[0].isPublic).toBe(true);
  });

  it("should parse witness functions", () => {
    const code = `
witness getSecret(): Field {
  return ledger.secretValue;
}
    `;

    const result = parseCompactFile("test.compact", code);

    expect(result.metadata.hasWitnesses).toBe(true);
    const witnesses = result.codeUnits.filter((u) => u.type === "witness");
    expect(witnesses.length).toBe(1);
    expect(witnesses[0].name).toBe("getSecret");
  });

  it("should parse imports", () => {
    const code = `
include "std";
include "crypto";

ledger {
  counter: Counter;
}
    `;

    const result = parseCompactFile("test.compact", code);

    expect(result.imports).toContain("std");
    expect(result.imports).toContain("crypto");
  });

  it("should parse a complete contract", () => {
    const code = `
include "std";

ledger {
  counter: Counter;
  messages: Map<Field, Opaque<"string">>;
  
  @private
  secretKey: Bytes<32>;
}

export circuit increment(amount: Field): Field {
  assert(amount > 0);
  ledger.counter.increment(amount);
  return ledger.counter.read();
}

export circuit postMessage(content: Opaque): Field {
  const id = ledger.counter.read();
  ledger.messages.insert(id, disclose(content));
  ledger.counter.increment(1);
  return id;
}

witness getSecretKey(): Bytes<32> {
  return ledger.secretKey;
}
    `;

    const result = parseCompactFile("test.compact", code);

    expect(result.metadata.hasLedger).toBe(true);
    expect(result.metadata.hasCircuits).toBe(true);
    expect(result.metadata.hasWitnesses).toBe(true);
    expect(result.imports).toContain("std");
    expect(result.exports).toContain("increment");
    expect(result.exports).toContain("postMessage");
  });
});

describe("TypeScript Parser", () => {
  it("should parse function declarations", () => {
    const code = `
export function increment(amount: number): number {
  return counter + amount;
}

async function fetchData(): Promise<string> {
  return await fetch('/api/data');
}
    `;

    const result = parseTypeScriptFile("test.ts", code);
    const functions = result.codeUnits.filter((u) => u.type === "function");

    expect(functions.length).toBe(2);
    expect(functions[0].name).toBe("increment");
    expect(functions[0].isPublic).toBe(true);
  });

  it("should parse class declarations", () => {
    const code = `
export class Counter {
  private value: number = 0;
  
  increment(amount: number): void {
    this.value += amount;
  }
}
    `;

    const result = parseTypeScriptFile("test.ts", code);
    const classes = result.codeUnits.filter((u) => u.type === "class");

    expect(classes.length).toBe(1);
    expect(classes[0].name).toBe("Counter");
    expect(classes[0].isPublic).toBe(true);
  });

  it("should parse interface declarations", () => {
    const code = `
export interface Transaction {
  id: string;
  amount: bigint;
  timestamp: number;
}
    `;

    const result = parseTypeScriptFile("test.ts", code);
    const interfaces = result.codeUnits.filter((u) => u.type === "interface");

    expect(interfaces.length).toBe(1);
    expect(interfaces[0].name).toBe("Transaction");
  });

  it("should parse imports", () => {
    const code = `
import { Counter } from './counter';
import * as utils from '@midnight/utils';

export const value = 42;
    `;

    const result = parseTypeScriptFile("test.ts", code);

    expect(result.imports).toContain("./counter");
    expect(result.imports).toContain("@midnight/utils");
  });
});

describe("Markdown Parser", () => {
  it("should parse headings as sections", () => {
    const code = `
# Main Title

Introduction text here.

## Section One

Content for section one.

### Subsection

More detailed content.

## Section Two

Content for section two.
    `;

    const result = parseMarkdownFile("test.md", code);

    expect(result.language).toBe("markdown");
    expect(result.codeUnits.length).toBeGreaterThan(0);
  });
});
