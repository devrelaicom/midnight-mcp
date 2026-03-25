import { logger } from "../../utils/index.js";
import {
  localSimulateDeploy,
  localSimulateCall,
  localSimulateState,
  localSimulateDelete,
} from "../../services/simulator.js";
import type {
  SimulateDeployInput,
  SimulateCallInput,
  SimulateStateInput,
  SimulateDeleteInput,
} from "./schemas.js";

export async function handleSimulateDeploy(input: SimulateDeployInput) {
  logger.info("Deploying contract for local simulation");
  return localSimulateDeploy(input.code, { version: input.version });
}

export async function handleSimulateCall(input: SimulateCallInput) {
  logger.info("Calling circuit on simulated contract", {
    sessionId: input.sessionId,
    circuit: input.circuit,
  });

  // Coerce argument values to strings
  const stringArgs = input.arguments
    ? Object.fromEntries(Object.entries(input.arguments).map(([k, v]) => [k, String(v)]))
    : undefined;

  return localSimulateCall(input.sessionId, input.circuit, stringArgs);
}

export async function handleSimulateState(input: SimulateStateInput) {
  logger.debug("Reading simulation state", { sessionId: input.sessionId });
  return localSimulateState(input.sessionId);
}

export async function handleSimulateDelete(input: SimulateDeleteInput) {
  logger.info("Deleting simulation session", { sessionId: input.sessionId });
  return localSimulateDelete(input.sessionId);
}
