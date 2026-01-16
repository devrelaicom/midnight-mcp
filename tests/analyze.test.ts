import { describe, it, expect } from "vitest";
import { analyzeContract, explainCircuit } from "../src/tools/analyze/index.js";

describe("Contract Analyzer", () => {
  it("should analyze a simple counter contract", async () => {
    const code = `
include "std";

ledger {
  counter: Counter;
}

export circuit increment(amount: Field): Field {
  assert(amount > 0);
  ledger.counter.increment(amount);
  return ledger.counter.read();
}
    `;

    const result = await analyzeContract({ code, checkSecurity: true });

    expect(result.summary.hasLedger).toBe(true);
    expect(result.summary.hasCircuits).toBe(true);
    expect(result.summary.publicCircuits).toBe(1);
    expect(result.structure.circuits.length).toBe(1);
    expect(result.structure.circuits[0].name).toBe("increment");
  });

  it("should detect security issues", async () => {
    const code = `
ledger {
  @private
  secretBalance: Field;
}

export circuit revealSecret(): Field {
  return ledger.secretBalance;
}
    `;

    const result = await analyzeContract({ code, checkSecurity: true });

    // Should warn about private data usage without protection
    expect(result.securityFindings.length).toBeGreaterThan(0);
  });

  it("should identify unused witnesses", async () => {
    const code = `
ledger {
  counter: Counter;
}

witness unusedWitness(): Field {
  return 42;
}

export circuit increment(amount: Field): Void {
  ledger.counter.increment(amount);
}
    `;

    const result = await analyzeContract({ code, checkSecurity: true });

    const unusedWitnessFindings = result.securityFindings.filter((f) =>
      f.message.includes("not used")
    );
    expect(unusedWitnessFindings.length).toBeGreaterThan(0);
  });
});

describe("Circuit Explainer", () => {
  it("should explain a circuit with disclose", async () => {
    const code = `
export circuit revealData(data: Field): Field {
  return disclose(data);
}
    `;

    const result = await explainCircuit({ circuitCode: code });

    expect(result.circuitName).toBe("revealData");
    expect(result.isPublic).toBe(true);
    expect(result.operations).toContain(
      "Reveals private data selectively (disclose)"
    );
    expect(result.zkImplications.length).toBeGreaterThan(0);
  });

  it("should explain a circuit with assertions", async () => {
    const code = `
export circuit validateAmount(amount: Field): Boolean {
  assert(amount > 0);
  assert(amount < 1000);
  return true;
}
    `;

    const result = await explainCircuit({ circuitCode: code });

    expect(result.circuitName).toBe("validateAmount");
    expect(result.operations).toContain("Validates constraints (assert)");
  });

  it("should identify state modifications", async () => {
    const code = `
export circuit deposit(amount: Field): Void {
  ledger.balance.increment(amount);
  ledger.transactions.insert(nextId(), amount);
}
    `;

    const result = await explainCircuit({ circuitCode: code });

    expect(result.operations).toContain("Increments a counter value");
    expect(result.operations).toContain("Inserts data into ledger storage");
  });
});
