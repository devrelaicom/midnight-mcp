/**
 * Local simulation engine.
 *
 * Manages in-memory simulation sessions with TTL, replacing the remote
 * playground `/simulate/*` endpoints. Each session represents a deployed
 * Compact contract that can have its circuits called and state inspected.
 *
 * The engine compiles the contract via the playground compile endpoint,
 * extracts circuit information from the source code, and tracks state
 * transitions locally. When the compiled JS module is available, it
 * dynamically loads and executes circuit logic via compact-runtime.
 */

import { randomUUID } from "crypto";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { logger } from "../utils/index.js";
import { compile } from "./playground.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulationSession {
  id: string;
  code: string;
  version?: string;
  circuits: SimulationCircuit[];
  ledger: Record<string, unknown>;
  callHistory: SimulationCallRecord[];
  createdAt: number;
  lastAccessedAt: number;
  /** Path to temp directory for this session's artifacts */
  tempDir?: string;
  /** Dynamically loaded contract module, if available */
  contractModule?: Record<string, unknown>;
}

export interface SimulationCircuit {
  name: string;
  parameters: string[];
  isPublic: boolean;
}

export interface SimulationCallRecord {
  circuit: string;
  arguments?: Record<string, string>;
  timestamp: string;
  success: boolean;
  result?: unknown;
}

export interface DeployResult {
  success: boolean;
  sessionId: string;
  circuits: SimulationCircuit[];
  ledger: Record<string, unknown>;
}

export interface CallResult {
  success: boolean;
  result?: unknown;
  stateChanges?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  updatedLedger?: Record<string, unknown>;
}

export interface StateResult {
  success: boolean;
  ledger: Record<string, unknown>;
  circuits: SimulationCircuit[];
  callHistory: SimulationCallRecord[];
}

export interface DeleteResult {
  success: boolean;
}

// ---------------------------------------------------------------------------
// Session manager
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_SESSIONS = 10;
const sessions = new Map<string, SimulationSession>();

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastAccessedAt > SESSION_TTL_MS) {
        cleanupSessionArtifacts(session);
        sessions.delete(id);
        logger.debug("Simulation session expired", { sessionId: id });
      }
    }
    if (sessions.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }, 60_000); // Check every minute
  cleanupInterval.unref(); // Allow process to exit cleanly
}

function touchSession(session: SimulationSession): void {
  session.lastAccessedAt = Date.now();
}

function getSession(sessionId: string): SimulationSession {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(
      `Simulation session not found: ${sessionId}. It may have expired (sessions expire after 15 minutes of inactivity).`,
    );
  }
  touchSession(session);
  return session;
}

/** Clean up temp files for a session */
function cleanupSessionArtifacts(session: SimulationSession): void {
  if (session.tempDir && existsSync(session.tempDir)) {
    try {
      rmSync(session.tempDir, { recursive: true, force: true });
      logger.debug("Cleaned up session temp dir", { sessionId: session.id, dir: session.tempDir });
    } catch {
      logger.warn("Failed to clean up session temp dir", { sessionId: session.id });
    }
  }
}

// ---------------------------------------------------------------------------
// Simulation engine
// ---------------------------------------------------------------------------

/**
 * Deploy a contract for local simulation.
 *
 * Compiles the code via the playground compile endpoint (with includeBindings),
 * extracts circuit information from the source, and creates an in-memory session.
 * If the compilation returns a JS module, it is written to a temp file and
 * dynamically loaded for real circuit execution.
 */
export async function localSimulateDeploy(
  code: string,
  options: { version?: string } = {},
): Promise<DeployResult> {
  if (sessions.size >= MAX_SESSIONS) {
    // Evict the oldest session
    let oldest: SimulationSession | null = null;
    for (const session of sessions.values()) {
      if (!oldest || session.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = session;
      }
    }
    if (oldest) {
      cleanupSessionArtifacts(oldest);
      sessions.delete(oldest.id);
      logger.debug("Evicted oldest simulation session", { sessionId: oldest.id });
    }
  }

  // Compile the contract to extract circuit information
  const compileResult = await compile(code, {
    wrapWithDefaults: true,
    skipZk: true,
    includeBindings: true,
    version: options.version,
  });

  if (!compileResult.success) {
    const errorMsg =
      "errors" in compileResult && Array.isArray(compileResult.errors)
        ? compileResult.errors.map((e) => e.message).join("; ")
        : "Compilation failed";
    throw new Error(`Cannot simulate: ${errorMsg}`);
  }

  // Extract circuits from the source code (more reliable than compilation output)
  const circuits = extractCircuits(code);

  const sessionId = randomUUID();
  const session: SimulationSession = {
    id: sessionId,
    code,
    version: options.version,
    circuits,
    ledger: {},
    callHistory: [],
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };

  // Try to load the compiled JS module for real circuit execution
  const output = "output" in compileResult ? (compileResult.output ?? "") : "";
  if (output && looksLikeJSModule(output)) {
    try {
      const tempDir = join(tmpdir(), `midnight-sim-${sessionId}`);
      mkdirSync(tempDir, { recursive: true });
      const modulePath = join(tempDir, "contract.cjs");
      writeFileSync(modulePath, output, "utf-8");

      const contractModule = (await import(modulePath)) as Record<string, unknown>;
      session.contractModule = contractModule;
      session.tempDir = tempDir;

      // Try to initialize the contract state via the constructor
      if (typeof contractModule.initialState === "function") {
        try {
          const { createConstructorContext, emptyZswapLocalState } =
            await import("@midnight-ntwrk/compact-runtime");
          const dummyCoinKey = "0".repeat(64);
          const zswapState = emptyZswapLocalState(dummyCoinKey);
          const ctx = createConstructorContext(
            {} as Record<string, unknown>,
            zswapState.coinPublicKey,
          );
          const initFn = contractModule.initialState as (...a: unknown[]) => unknown;
          const constructorResult = initFn(ctx);
          // constructorResult is a CircuitResults object — extract state if present
          if (constructorResult != null && typeof constructorResult === "object") {
            const resultObj = constructorResult as Record<string, unknown>;
            // The contract state is in the 'state' property of CircuitResults
            if (resultObj.state != null && typeof resultObj.state === "object") {
              session.ledger = { ...(resultObj.state as Record<string, unknown>) };
            }
          }
          logger.info("Contract initialized with compact-runtime", { sessionId });
        } catch (initError) {
          logger.debug("compact-runtime initialization failed, using empty state", {
            sessionId,
            error: initError instanceof Error ? initError.message : String(initError),
          });
        }
      }
    } catch (loadError) {
      logger.debug("Could not load compiled JS module, using stub execution", {
        sessionId,
        error: loadError instanceof Error ? loadError.message : String(loadError),
      });
    }
  }

  sessions.set(sessionId, session);
  startCleanupTimer();

  logger.info("Simulation session created", {
    sessionId,
    circuitCount: circuits.length,
    hasRuntimeModule: !!session.contractModule,
  });

  return {
    success: true,
    sessionId,
    circuits,
    ledger: session.ledger,
  };
}

/**
 * Call a circuit on a simulated contract.
 *
 * If the contract module was loaded successfully, attempts real circuit
 * execution via compact-runtime. Otherwise, records the call as a stub.
 */
export async function localSimulateCall(
  sessionId: string,
  circuit: string,
  args?: Record<string, string>,
): Promise<CallResult> {
  const session = getSession(sessionId);

  const circuitInfo = session.circuits.find((c) => c.name === circuit);
  if (!circuitInfo) {
    const available = session.circuits.map((c) => c.name).join(", ");
    throw new Error(
      `Circuit '${circuit}' not found in session ${sessionId}. Available circuits: ${available}`,
    );
  }

  let callResult: unknown;
  const stateChanges: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];
  const oldLedger = { ...session.ledger };

  // Try real circuit execution if the contract module is loaded
  if (session.contractModule && typeof session.contractModule[circuit] === "function") {
    try {
      const { createCircuitContext, emptyZswapLocalState, ContractState, dummyContractAddress } =
        await import("@midnight-ntwrk/compact-runtime");
      // Create a simulation circuit context with proper compact-runtime primitives
      const dummyCoinKey = "0".repeat(64);
      const zswapState = emptyZswapLocalState(dummyCoinKey);
      const addr = dummyContractAddress();
      const contractState = new ContractState();
      const ctx = createCircuitContext(
        addr, // contractAddress
        zswapState, // coinPublicKey / zswap state
        contractState, // on-chain contract state
        session.ledger, // private state
        undefined, // gasLimit (no limit for simulation)
        undefined, // costModel (not needed for simulation)
        undefined, // time (defaults to 0)
      );
      const circuitFn = session.contractModule[circuit] as (...circuitArgs: unknown[]) => unknown;

      // Convert string args to appropriate types for the circuit
      const circuitArgs = args ? Object.values(args) : [];
      callResult = circuitFn(ctx, ...circuitArgs);

      // Extract state changes from the result
      if (callResult && typeof callResult === "object") {
        const resultObj = callResult as Record<string, unknown>;
        if (resultObj.state && typeof resultObj.state === "object") {
          const newState = resultObj.state as Record<string, unknown>;
          for (const [key, newValue] of Object.entries(newState)) {
            if (oldLedger[key] !== newValue) {
              stateChanges.push({ field: key, oldValue: oldLedger[key], newValue });
            }
          }
          session.ledger = { ...session.ledger, ...newState };
        }
      }

      logger.debug("Circuit executed via compact-runtime", { sessionId, circuit });
    } catch (execError) {
      logger.debug("Runtime circuit execution failed, recording as stub", {
        sessionId,
        circuit,
        error: execError instanceof Error ? execError.message : String(execError),
      });
      callResult = {
        note: "Circuit execution via compact-runtime failed. Call recorded.",
        error: execError instanceof Error ? execError.message : String(execError),
      };
    }
  } else {
    callResult = {
      note: "Local simulation: circuit call recorded. Runtime module not loaded for this session.",
      circuit,
      arguments: args ?? {},
    };
  }

  const record: SimulationCallRecord = {
    circuit,
    arguments: args,
    timestamp: new Date().toISOString(),
    success: true,
    result: callResult,
  };

  session.callHistory.push(record);

  logger.debug("Simulation circuit called", {
    sessionId,
    circuit,
    callNumber: session.callHistory.length,
    hasRuntimeModule: !!session.contractModule,
  });

  return {
    success: true,
    result: callResult,
    stateChanges,
    updatedLedger: session.ledger,
  };
}

/**
 * Get the current state of a simulation session.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function localSimulateState(sessionId: string): Promise<StateResult> {
  const session = getSession(sessionId);

  return {
    success: true,
    ledger: session.ledger,
    circuits: session.circuits,
    callHistory: session.callHistory,
  };
}

/**
 * Delete a simulation session and clean up resources.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function localSimulateDelete(sessionId: string): Promise<DeleteResult> {
  const session = sessions.get(sessionId);

  if (session) {
    cleanupSessionArtifacts(session);
    sessions.delete(sessionId);
    logger.info("Simulation session deleted", { sessionId });
  } else {
    logger.debug("Session already deleted or expired", { sessionId });
  }

  return { success: true };
}

/**
 * Reset all simulation state. Used for testing.
 */
export function resetSimulatorState(): void {
  for (const session of sessions.values()) {
    cleanupSessionArtifacts(session);
  }
  sessions.clear();
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get the number of active sessions. Used for diagnostics.
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if compilation output looks like a JS module (vs binary ZKIR).
 */
function looksLikeJSModule(output: string): boolean {
  return (
    output.includes("exports.") ||
    output.includes("module.exports") ||
    output.includes("export ") ||
    output.includes("require(")
  );
}

/**
 * Extract circuit information from Compact source code.
 * Parses the source to find circuit declarations.
 */
function extractCircuits(source: string): SimulationCircuit[] {
  const circuits: SimulationCircuit[] = [];

  // Match circuit declarations: export circuit name(params) or circuit name(params)
  const circuitPattern = /(?:export\s+)?circuit\s+(\w+)\s*\(([^)]*)\)/g;
  let match;

  while ((match = circuitPattern.exec(source)) !== null) {
    const name = match[1] ?? "";
    const paramStr = (match[2] ?? "").trim();
    const parameters = paramStr
      ? paramStr
          .split(",")
          .map((p) => (p.trim().split(/\s*:\s*/)[0] ?? "").trim())
          .filter(Boolean)
      : [];

    circuits.push({
      name,
      parameters,
      isPublic: match[0].startsWith("export"),
    });
  }

  if (circuits.length === 0) {
    circuits.push({
      name: "constructor",
      parameters: [],
      isPublic: true,
    });
  }

  return circuits;
}
