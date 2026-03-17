import type { ExtendedToolDefinition } from "../../types/index.js";
import { zodInputSchema } from "../../utils/schema.js";
import {
  SimulateDeployInputSchema,
  SimulateCallInputSchema,
  SimulateStateInputSchema,
  SimulateDeleteInputSchema,
} from "./schemas.js";
import {
  handleSimulateDeploy,
  handleSimulateCall,
  handleSimulateState,
  handleSimulateDelete,
} from "./handlers.js";

export const simulateTools: ExtendedToolDefinition[] = [
  {
    name: "midnight-simulate-deploy",
    description: `Deploy a Compact contract for interactive simulation.

Returns a sessionId that MUST be passed to subsequent simulate calls (midnight-simulate-call,
midnight-simulate-state, midnight-simulate-delete). Sessions expire after 15 minutes of inactivity.

Workflow: deploy → call circuits → inspect state → delete session.`,
    inputSchema: zodInputSchema(SimulateDeployInputSchema),
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      title: "Deploy Contract for Simulation",
      category: "analyze",
    },
    handler: handleSimulateDeploy,
  },
  {
    name: "midnight-simulate-call",
    description: `Execute a circuit on a simulated contract.

Requires a sessionId from midnight-simulate-deploy. Returns the circuit result,
state changes, and updated ledger values.`,
    inputSchema: zodInputSchema(SimulateCallInputSchema),
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
      title: "Call Circuit on Simulation",
      category: "analyze",
    },
    handler: handleSimulateCall,
  },
  {
    name: "midnight-simulate-state",
    description: `Read the current state of a simulation session.

Returns ledger values, available circuits, and call history. Requires a sessionId
from midnight-simulate-deploy.`,
    inputSchema: zodInputSchema(SimulateStateInputSchema),
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
      title: "Get Simulation State",
      category: "analyze",
    },
    handler: handleSimulateState,
  },
  {
    name: "midnight-simulate-delete",
    description: `End a simulation session and free resources.

Use when done interacting with a simulated contract. Sessions also auto-expire
after 15 minutes of inactivity.`,
    inputSchema: zodInputSchema(SimulateDeleteInputSchema),
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: true,
      title: "Delete Simulation Session",
      category: "analyze",
    },
    handler: handleSimulateDelete,
  },
];
