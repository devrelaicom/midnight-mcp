import { logger } from "../../utils/index.js";
import {
  simulateDeploy,
  simulateCall,
  simulateState,
  simulateDelete,
} from "../../services/playground.js";
import type {
  SimulateDeployInput,
  SimulateCallInput,
  SimulateStateInput,
  SimulateDeleteInput,
} from "./schemas.js";

export async function handleSimulateDeploy(input: SimulateDeployInput) {
  logger.info("Deploying contract for simulation");
  return simulateDeploy(input.code, { version: input.version });
}

export async function handleSimulateCall(input: SimulateCallInput) {
  logger.info("Calling circuit on simulated contract", {
    sessionId: input.sessionId,
    circuit: input.circuit,
  });

  // Coerce argument values to strings — the playground expects Record<string, string>
  const stringArgs = input.arguments
    ? Object.fromEntries(Object.entries(input.arguments).map(([k, v]) => [k, String(v)]))
    : undefined;

  return simulateCall(input.sessionId, input.circuit, stringArgs);
}

export async function handleSimulateState(input: SimulateStateInput) {
  logger.debug("Reading simulation state", { sessionId: input.sessionId });
  return simulateState(input.sessionId);
}

export async function handleSimulateDelete(input: SimulateDeleteInput) {
  logger.info("Deleting simulation session", { sessionId: input.sessionId });
  return simulateDelete(input.sessionId);
}
