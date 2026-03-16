/**
 * Embedded documentation content
 *
 * DESIGN PRINCIPLE: This file contains ONLY curated/unique content that:
 * 1. Doesn't exist in official docs in this form
 * 2. Is a synthesized summary (tokenomics whitepaper)
 * 3. Is a quick reference card (compact-reference)
 *
 * For official Midnight docs (glossary, Zswap, Kachina concepts),
 * use the search_docs tool which queries the Vector DB.
 */

export const EMBEDDED_DOCS: Record<string, string> = {
  "midnight://docs/compact-reference": `# Compact Language Syntax Reference (v0.16 - v0.18)

> **CRITICAL**: This reference is derived from **actual compiling contracts** in the Midnight ecosystem.
> Always verify syntax against this reference before generating contracts.

## Quick Start Template

Use this as a starting point - it compiles successfully:

\`\`\`compact
pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

// Ledger state (individual declarations, NOT a block)
export ledger counter: Counter;
export ledger owner: Bytes<32>;

// Witness for private/off-chain data
witness local_secret_key(): Bytes<32>;

// Circuit (returns [] not Void)
export circuit increment(): [] {
  counter.increment(1);
}
\`\`\`

---

## 1. Pragma (Version Declaration)

**CORRECT** - use bounded range without patch version:
\`\`\`compact
pragma language_version >= 0.16 && <= 0.18;
\`\`\`

**WRONG** - these will cause parse errors:
\`\`\`compact
pragma language_version >= 0.14.0;           // ❌ patch version not needed
pragma language_version >= 0.16.0 < 0.19.0;  // ❌ wrong operator format
\`\`\`

---

## 2. Imports

Always import the standard library:
\`\`\`compact
import CompactStandardLibrary;
\`\`\`

For modular code, use module imports (not a separate \`include\` directive):
\`\`\`compact
import "path/to/module";
import { SomeType } from "other/module";
\`\`\`

> **Note:** The docs describe modules and \`import\` syntax, but do not document
> a separate \`include\` directive. Use \`import\` for code organization.

---

## 3. Ledger Declarations

**CORRECT** - individual declarations with \`export ledger\`:
\`\`\`compact
export ledger counter: Counter;
export ledger owner: Bytes<32>;
export ledger balances: Map<Bytes<32>, Uint<64>>;

// Private state (off-chain only)
ledger secretValue: Field;  // no export = private
\`\`\`

**WRONG** - block syntax is deprecated:
\`\`\`compact
// ❌ This causes parse error: found "{" looking for an identifier
ledger {
  counter: Counter;
  owner: Bytes<32>;
}
\`\`\`

### Ledger Modifiers

\`\`\`compact
export ledger publicData: Field;           // Public, readable by anyone
export sealed ledger immutableData: Field; // Set once in constructor, cannot change
ledger privateData: Field;                 // Private, not exported
\`\`\`

---

## 4. Data Types

### Primitive Types
| Type | Description | Example |
|------|-------------|---------|
| \`Field\` | Finite field element (basic numeric) | \`amount: Field\` |
| \`Boolean\` | True or false | \`isActive: Boolean\` |
| \`Bytes<N>\` | Fixed-size byte array | \`hash: Bytes<32>\` |
| \`Uint<N>\` | Unsigned integer (N bits) | \`balance: Uint<64>\` |
| \`Uint<0..MAX>\` | Bounded unsigned integer | \`score: Uint<0..100>\` |

**⚠️ Uint Type Equivalence** (documented in [Primitive Types](https://docs.midnight.network/develop/reference/compact/lang-ref#primitive-types)):

\`Uint<N>\` (sized) and \`Uint<0..MAX>\` (bounded) are the **SAME type family**.
\`Uint<N>\` is exactly equivalent to \`Uint<0..(2^N - 1)>\`:
- \`Uint<8>\` = \`Uint<0..255>\` (2^8 - 1 = 255)
- \`Uint<16>\` = \`Uint<0..65535>\` (2^16 - 1 = 65535)
- \`Uint<64>\` = \`Uint<0..18446744073709551615>\`

These can be used interchangeably. The lower bound must currently be 0.

**Arithmetic** (documented in [Binary Arithmetic](https://docs.midnight.network/develop/reference/compact/lang-ref#binary-arithmetic-expressions)):
- Operators: \`+\`, \`-\`, \`*\` only (division \`/\` and modulo \`%\` are NOT mentioned in docs)
- Result types expand: \`Uint<0..m> + Uint<0..n>\` → \`Uint<0..m+n>\`
- Subtraction can fail at runtime if result would be negative
- ⚠️ If you need division, you may need a witness to compute it off-chain

### Collection Types
| Type | Description | Example |
|------|-------------|---------|
| \`Counter\` | Incrementable/decrementable | \`count: Counter\` |
| \`Map<K, V>\` | Key-value mapping | \`Map<Bytes<32>, Uint<64>>\` |
| \`Set<T>\` | Unique value collection | \`Set<Bytes<32>>\` |
| \`Vector<N, T>\` | Fixed-size array | \`Vector<3, Field>\` |
| \`List<T>\` | Dynamic list | \`List<Bytes<32>>\` |
| \`Maybe<T>\` | Optional value (has/hasn't) | \`Maybe<Bytes<32>>\` |
| \`Either<L, R>\` | Sum type (one or other) | \`Either<Field, Bytes<32>>\` |
| \`Opaque<s>\` | Opaque value tagged by string s | \`Opaque<"string">\` |

**Opaque Types** ([Primitive Types](https://docs.midnight.network/develop/reference/compact/lang-ref#primitive-types)):
- Only two tags allowed: \`Opaque<"string">\` and \`Opaque<"Uint8Array">\`
- Opaque values can be manipulated in witnesses but are opaque to circuits
- In circuits, they are represented as their hash (cannot inspect content)
- In your DApp's JS/TS, they are just \`string\` or \`Uint8Array\`
- On-chain, they are stored as bytes/UTF-8 (not encrypted)

### Custom Types

**Enums** - must use \`export\` to access from TypeScript:
\`\`\`compact
export enum GameState { waiting, playing, finished }
export enum Choice { rock, paper, scissors }
\`\`\`

**Enum Access Syntax** - use DOT notation (not Rust-style ::):
\`\`\`compact
// CORRECT - dot notation
if (choice == Choice.rock) { ... }
game_state = GameState.waiting;

// WRONG - Rust-style double colon
if (choice == Choice::rock) { ... }  // ❌ Parse error: found ":" looking for ")"
\`\`\`

**Structs**:
\`\`\`compact
export struct PlayerConfig {
  name: Opaque<"string">,
  score: Uint<32>,
  isActive: Boolean,
}
\`\`\`

---

## 5. Circuits

Circuits are on-chain functions that generate ZK proofs.

**CRITICAL**: Return type is \`[]\` (empty tuple), NOT \`Void\`:

\`\`\`compact
// CORRECT - returns []
export circuit increment(): [] {
  counter.increment(1);
}

// CORRECT - with parameters
export circuit transfer(to: Bytes<32>, amount: Uint<64>): [] {
  assert(amount > 0, "Amount must be positive");
  // ... logic
}

// CORRECT - with return value
export circuit getBalance(addr: Bytes<32>): Uint<64> {
  return balances.lookup(addr);
}

// WRONG - Void does not exist
export circuit broken(): Void {  // ❌ Parse error
  counter.increment(1);
}
\`\`\`

### Circuit Modifiers

\`\`\`compact
export circuit publicFn(): []      // Callable externally
circuit internalFn(): []           // Internal only, not exported
export pure circuit hash(x: Field): Bytes<32>  // No state access
\`\`\`

---

## 6. Witnesses

Witnesses provide off-chain/private data to circuits. They run locally, not on-chain.

**CRITICAL**: Witnesses are declarations only - NO implementation body in Compact!
The implementation goes in your TypeScript prover.

\`\`\`compact
// ✅ CORRECT - declaration only, semicolon at end
witness local_secret_key(): Bytes<32>;
witness get_merkle_path(leaf: Bytes<32>): MerkleTreePath<10, Bytes<32>>;
witness store_locally(data: Field): [];
witness find_user(id: Bytes<32>): Maybe<UserData>;

// ❌ WRONG - witnesses cannot have bodies
witness get_caller(): Bytes<32> {
  return public_key(local_secret_key());  // ERROR!
}
\`\`\`

---

## 7. Constructor

Optional - initializes sealed ledger fields at deploy time:

\`\`\`compact
export sealed ledger owner: Bytes<32>;
export sealed ledger nonce: Bytes<32>;

constructor(initNonce: Bytes<32>) {
  owner = disclose(public_key(local_secret_key()));
  nonce = disclose(initNonce);
}
\`\`\`

---

## 7.5 Pure Circuits (Helper Functions)

Use \`pure circuit\` for helper functions that don't modify ledger state:

\`\`\`compact
// ✅ CORRECT - use "pure circuit"
pure circuit determine_winner(p1: Choice, p2: Choice): Result {
  if (p1 == p2) {
    return Result.draw;
  }
  // ... logic
}

// ❌ WRONG - "function" keyword doesn't exist
pure function determine_winner(p1: Choice, p2: Choice): Result {
  // ERROR: unbound identifier "function"
}
\`\`\`

---

## 8. Common Patterns

### Authentication Pattern
\`\`\`compact
witness local_secret_key(): Bytes<32>;

// IMPORTANT: public_key() is NOT a builtin - use this pattern
circuit get_public_key(sk: Bytes<32>): Bytes<32> {
  return persistentHash<Vector<2, Bytes<32>>>([pad(32, "myapp:pk:"), sk]);
}

export circuit authenticated_action(): [] {
  const sk = local_secret_key();
  const caller = get_public_key(sk);
  assert(disclose(caller == owner), "Not authorized");
  // ... action
}
\`\`\`

### Commit-Reveal Pattern (COMPLETE, VALIDATED)
\`\`\`compact
pragma language_version >= 0.16 && <= 0.18;

import CompactStandardLibrary;

// Ledger state
export ledger commitment: Bytes<32>;
export ledger revealed_value: Field;
export ledger is_revealed: Boolean;

// Witnesses for off-chain storage
witness local_secret_key(): Bytes<32>;
witness store_secret_value(v: Field): [];
witness get_secret_value(): Field;

// Helper: compute commitment hash
circuit compute_commitment(value: Field, salt: Bytes<32>): Bytes<32> {
  // Convert Field to Bytes for hashing
  const value_bytes = value as Bytes<32>;
  return persistentHash<Vector<2, Bytes<32>>>([value_bytes, salt]);
}

// Commit phase: store hash on-chain, value off-chain
export circuit commit(value: Field): [] {
  const salt = local_secret_key();
  store_secret_value(value);
  commitment = disclose(compute_commitment(value, salt));
  is_revealed = false;
}

// Reveal phase: verify stored value matches commitment
export circuit reveal(): Field {
  const salt = local_secret_key();
  const value = get_secret_value();
  const expected = compute_commitment(value, salt);
  assert(disclose(expected == commitment), "Value doesn't match commitment");
  assert(disclose(!is_revealed), "Already revealed");
  
  revealed_value = disclose(value);
  is_revealed = true;
  return disclose(value);
}
\`\`\`

### Disclosure in Conditionals
When branching on witness values, wrap comparisons in \`disclose()\`:

\`\`\`compact
// CORRECT
export circuit check(guess: Field): Boolean {
  const secret = get_secret();  // witness
  if (disclose(guess == secret)) {
    return true;
  }
  return false;
}

// WRONG - will not compile
export circuit check_broken(guess: Field): Boolean {
  const secret = get_secret();
  if (guess == secret) {  // ❌ implicit disclosure error
    return true;
  }
  return false;
}
\`\`\`

---

## 9. Common Operations

### Counter Operations
\`\`\`compact
// ALL Counter methods work in circuits:
counter.increment(1);           // Increase by amount (Uint<16>)
counter.decrement(1);           // Decrease by amount (Uint<16>)
const val = counter.read();     // Get current value (returns Uint<64>)
const low = counter.lessThan(100); // Compare with threshold (returns Boolean)
counter.resetToDefault();       // Reset to zero

// ⚠️ WRONG: counter.value() does NOT exist - use counter.read()
\`\`\`

### Map Operations
\`\`\`compact
// Map<key_type, value_type> - All operations work in circuits unless noted

// Insert/update operations
balances.insert(address, 100);           // insert(key, value): []
balances.insertDefault(address);         // insertDefault(key): [] - inserts default value

// Query operations (all work in circuits ✅)
const balance = balances.lookup(address);  // lookup(key): value_type
const exists = balances.member(address);   // member(key): Boolean

// ⚠️ UNDOCUMENTED: Map.lookup() behavior when key doesn't exist
// The docs show: lookup(key: key_type): value_type (NOT Maybe<value_type>)
// This implies it returns a default value, not an optional.
// RECOMMENDED: Always check member() first:
if (balances.member(address)) {
  const balance = balances.lookup(address);  // Safe
}
const empty = balances.isEmpty();          // isEmpty(): Boolean
const count = balances.size();             // size(): Uint<64>

// Remove operations
balances.remove(address);                // remove(key): []
balances.resetToDefault();               // resetToDefault(): [] - clears entire map

// Coin-specific (only when value_type is QualifiedCoinInfo)
// coinMap.insertCoin(key, coinInfo, recipient): []
\`\`\`

**TypeScript-only:** \`[Symbol.iterator]()\` for iteration - not available in circuits.

### Set Operations
\`\`\`compact
// Set<value_type> - All operations work in circuits unless noted

// Insert/remove operations
members.insert(address);                    // insert(elem): []
members.remove(address);                    // remove(elem): []
members.resetToDefault();                   // resetToDefault(): [] - clears entire set

// Query operations (all work in circuits ✅)
const isMember = members.member(address);   // member(elem): Boolean
const empty = members.isEmpty();            // isEmpty(): Boolean
const count = members.size();               // size(): Uint<64>

// Coin-specific (only when value_type is QualifiedCoinInfo)
// coinSet.insertCoin(coinInfo, recipient): []
\`\`\`

**TypeScript-only:** \`[Symbol.iterator]()\` for iteration - not available in circuits.

### Maybe Operations
\`\`\`compact
// Creating Maybe values
const opt: Maybe<Field> = some<Field>(42);     // Wrap a value
const empty: Maybe<Field> = none<Field>();     // No value

// Checking and accessing
if (opt.is_some) {
  const val = opt.value;  // Safe to access when is_some is true
}

// Common patterns
witness find_user(id: Bytes<32>): Maybe<UserRecord>;

export circuit getUser(id: Bytes<32>): UserRecord {
  const result = find_user(id);
  assert(disclose(result.is_some), "User not found");
  return result.value;
}
\`\`\`

### Either Operations
\`\`\`compact
// Creating Either values
const success: Either<Field, Bytes<32>> = left<Field, Bytes<32>>(42);
const failure: Either<Field, Bytes<32>> = right<Field, Bytes<32>>(errorHash);

// Checking which side
if (result.is_left) {
  const value = result.left;   // The left value (often "success")
} else {
  const error = result.right;  // The right value (often "error")
}

// Common pattern: burnAddress() returns Either<ZswapCoinPublicKey, ContractAddress>
export circuit withdraw(): [] {
  const addr = burnAddress();
  assert(disclose(addr.is_right), "Expected contract address");
  // addr.right is the ContractAddress
}
\`\`\`

### Type Casting ([Type Casts Reference](https://docs.midnight.network/develop/reference/compact/lang-ref#type-cast-expressions))

**Syntax**: \`expression as Type\` (only form; \`<Type>expression\` is NOT supported)

**Cast kinds**: static (always succeeds), conversion (semantic change), checked (can fail at runtime)

\`\`\`compact
// Uint ↔ Field (safe)
const field: Field = myUint as Field;           // static: always succeeds
const num: Uint<64> = myField as Uint<64>;      // checked: fails if out of range

// Uint widening/narrowing
const big: Uint<64> = small as Uint<64>;        // static: widening always works
const small: Uint<32> = big as Uint<32>;        // checked: narrowing can fail

// Field ↔ Bytes (can fail at runtime!)
const bytes: Bytes<32> = myField as Bytes<32>;  // conversion: fails if doesn't fit
const field: Field = myBytes as Field;          // conversion: fails if exceeds max Field

// Uint → Bytes (NOT direct - use two casts)
const amount_bytes = (amount as Field) as Bytes<32>;

// Boolean → Uint (conversion: false→0, true→1)
const flag: Boolean = true;
const flagInt: Uint<0..1> = flag as Uint<0..1>;

// Enum → Field (conversion)
const index: Field = choice as Field;

// ⚠️ Boolean → Field is NOT allowed!
// Must go through Uint: (flag as Uint<0..1>) as Field

// ⚠️ UNDOCUMENTED: Bytes<n> ↔ Vector<n, Uint<8>> casting
// The type cast table doesn't mention this conversion.
// If you need to convert, you may need a witness helper.
\`\`\`

### Hashing
\`\`\`compact
// Persistent hash (same input = same output across calls)
const hash = persistentHash<Vector<2, Bytes<32>>>([data1, data2]);

// Persistent commit (hiding commitment)
const commit = persistentCommit<Field>(value);
\`\`\`

---

## 10. Assertions

\`\`\`compact
assert(condition, "Error message");
assert(amount > 0, "Amount must be positive");
assert(disclose(caller == owner), "Not authorized");
\`\`\`

---

## 11. Common Mistakes to Avoid

| Mistake | Correct |
|---------|---------|
| \`ledger { field: Type; }\` | \`export ledger field: Type;\` |
| \`circuit fn(): Void\` | \`circuit fn(): []\` |
| \`pragma >= 0.16.0\` | \`pragma >= 0.16 && <= 0.18\` |
| \`enum State { ... }\` | \`export enum State { ... }\` |
| \`if (witness_val == x)\` | \`if (disclose(witness_val == x))\` |
| \`Cell<Field>\` | \`Field\` (Cell is deprecated) |
| \`myValue.read()\` / \`.write()\` | Direct assignment: \`myValue = x\` |

---

## 12. Undocumented / Unclear Features

These features are not clearly documented. Use with caution:

| Feature | Status | Notes |
|---------|--------|-------|
| Tuple destructuring | ❓ Unknown | \`const [a, b] = pair;\` - not documented |
| Constant folding in indices | ❓ Unknown | \`v[2 * i]\` where i is const - docs say "numeric literal" required |
| Division \`/\` and modulo \`%\` | ❓ Not in docs | Only +, -, * are documented |
| \`Bytes<n>\` ↔ \`Vector<n, Uint<8>>\` | ❓ Not in cast table | May need witness workaround |

**Recommendation**: Test these in the compiler before relying on them in production contracts.

---

## 13. Exports for TypeScript

To use types/values in TypeScript, they must be exported:

\`\`\`compact
// These are accessible from TypeScript
export enum GameState { waiting, playing }
export struct Config { value: Field }
export ledger counter: Counter;
export circuit play(): []

// Standard library re-exports (if needed in TS)
export { Maybe, Either, CoinInfo };
\`\`\`

---

## Reference Contracts

These contracts compile successfully and demonstrate correct patterns:

1. **Counter** (beginner): \`midnightntwrk/example-counter\`
2. **Bulletin Board** (intermediate): \`midnightntwrk/example-bboard\`  
3. **Naval Battle Game** (advanced): \`ErickRomeroDev/naval-battle-game_v2\`
4. **Sea Battle** (advanced): \`bricktowers/midnight-seabattle\`

When in doubt, reference these repos for working syntax.
`,

  "midnight://docs/compiler": `# Compact Compiler Guide

**Source:** [Building a Midnight DApp](https://docs.midnight.network/develop/tutorial/building)

## Compiling Contracts

> **IMPORTANT:** The old \`compactc\` command is deprecated. Use \`compact compile\` instead.

### Basic Usage

\`\`\`bash
# Syntax: compact compile <source.compact> <output_directory>
compact compile src/counter.compact managed/counter

# With environment setup
nvm use 18
compact compile contract/src/mycontract.compact managed/mycontract
\`\`\`

### Compiler Output Structure

**Source:** [Generated Source Details](https://docs.midnight.network/develop/tutorial/building/dapp-details#generated-source)

When you compile a \`.compact\` file, the compiler generates this directory structure:

\`\`\`
managed/<contract_name>/
├── contract/                 # TypeScript bindings
│   ├── index.cjs             # CommonJS module with Contract class
│   ├── index.d.cts           # TypeScript type declarations
│   └── index.mjs             # ESM module (optional)
│
├── zkir/                     # Zero-knowledge circuit representations
│   └── <circuit_name>.zkir   # Circuit intermediate representation
│
├── keys/                     # Proving and verifying keys
│   ├── <circuit>.prover      # Prover key (used client-side)
│   └── <circuit>.verifier    # Verifier key (used on-chain)
│
└── compiler/                 # Compilation metadata
    └── metadata.json         # Version info, circuit IDs, etc.
\`\`\`

### Understanding Generated Files

#### contract/ - TypeScript Bindings

The \`contract/\` directory contains your TypeScript interface:

\`\`\`typescript
// Import from generated bindings
import { Contract, ledger } from './managed/counter/contract/index.cjs';

// Create contract instance
const contract = new Contract(witnesses);

// Access circuits
const tx = await contract.impureCircuits.increment(5n);

// Read ledger state
const state = ledger(contractState);
console.log('Counter value:', state.counter);
\`\`\`

#### keys/ - ZK Proving/Verifying Keys

- **\`.prover\`** - Used by the client to generate proofs (can be large, 10-100MB+)
- **\`.verifier\`** - Used on-chain to verify proofs (small, kilobytes)

\`\`\`typescript
// Keys are loaded automatically by the SDK
import { proverKey, verifierKey } from './managed/counter/keys';

// Or loaded from files
const prover = await fs.readFile('managed/counter/keys/increment.prover');
\`\`\`

#### zkir/ - Circuit Intermediate Representation

The \`.zkir\` files are internal representations used by the proof system. You typically don't interact with these directly.

### Cleaning and Rebuilding

When updating contracts or after Compact version changes:

\`\`\`bash
# Clean generated files
rm -rf managed/<contract_name>

# Or clean specific artifacts
rm -rf managed/counter/keys/*.prover managed/counter/keys/*.verifier

# Rebuild
compact compile src/counter.compact managed/counter
\`\`\`

### Common Compilation Errors

#### "invalid context for a ledger ADT type"

Ledger ADT types cannot be used in type casts:

\`\`\`compact
// ❌ Wrong
const x = value as Counter;

// ✅ Correct - use ledger field directly
ledger.counter.increment(1);
\`\`\`

#### Version Mismatch After Update

When runtime versions don't match compiled artifacts:

\`\`\`bash
# 1. Check versions
compact --version
npm list @midnight-ntwrk/compact-runtime

# 2. Consult compatibility matrix
# https://docs.midnight.network/relnotes/support-matrix

# 3. Clean and recompile
rm -rf managed/
compact compile src/contract.compact managed/contract
\`\`\`

### Integration with Build Tools

#### package.json scripts

\`\`\`json
{
  "scripts": {
    "compile": "compact compile src/contract.compact managed/contract",
    "compile:clean": "rm -rf managed && npm run compile",
    "build": "npm run compile && tsc"
  }
}
\`\`\`

#### Watch mode (development)

\`\`\`bash
# Using nodemon or similar
nodemon --watch src/*.compact --exec "compact compile src/contract.compact managed/contract"
\`\`\`
`,

  "midnight://docs/tokenomics": `# Midnight Tokenomics Summary

A curated summary of the Midnight Tokenomics Whitepaper (June 2025).

## Dual-Token Model

Midnight uses two components: **NIGHT** (token) and **DUST** (resource).

### NIGHT Token
- **Supply**: 24 billion (fixed)
- **Subunit**: 1 NIGHT = 1,000,000 STARs
- **Visibility**: Unshielded (public)
- **Function**: Generates DUST, governance, block rewards
- **Multi-chain**: Native on both Cardano and Midnight

### DUST Resource
- **Type**: Shielded, non-transferable
- **Function**: Pay transaction fees
- **Generation**: Continuously from NIGHT holdings
- **Decay**: When disassociated from NIGHT
- **Privacy**: Transactions don't leak metadata

## Key Insight: NIGHT Generates DUST

\`\`\`
Hold NIGHT → Generates DUST → Pay for transactions
         (continuous)      (consumed on use)
\`\`\`

This means: **Hold NIGHT, transact "for free"** (no recurring token spend)

## Block Rewards

**Formula**:
\`\`\`
Actual Reward = Base Reward × [S + (1-S) × U]

Where:
- S = Subsidy rate (95% at launch)
- U = Block utilization (target: 50%)
\`\`\`

- Full blocks: Producer gets 100% of base reward
- Empty blocks: Producer gets only subsidy (95%)
- Remainder goes to Treasury

## Token Distribution

### Phase 1: Glacier Drop (60 days)
- Free allocation to crypto holders
- 50% to Cardano, 20% to Bitcoin, 30% to others
- Minimum $100 USD equivalent required

### Phase 2: Scavenger Mine (30 days)  
- Computational puzzles (accessible to public)
- Claims unclaimed Glacier Drop tokens
- Seeds network constituents

### Phase 3: Lost-and-Found (4 years)
- Second chance for Glacier Drop eligible
- Fractional allocation

## Key Differentiators

1. **No token spend for transactions** - DUST is renewable
2. **MEV resistant** - Shielded transactions
3. **Cross-chain native** - Same token on Cardano + Midnight
4. **Fair distribution** - Free, multi-phase, broad eligibility
`,
};
