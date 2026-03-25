import { z } from "zod";

export const SimulateDeployInputSchema = z.object({
  code: z.string().describe("Compact contract source code to deploy for simulation"),
  version: z.string().optional().describe("Compiler version (e.g. '0.29.0')"),
});

export const SimulateCallInputSchema = z.object({
  sessionId: z.string().describe("Simulation session ID returned from midnight-simulate-deploy"),
  circuit: z.string().describe("Name of the circuit to execute"),
  arguments: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe("Arguments to pass to the circuit (values are coerced to strings)"),
});

export const SimulateStateInputSchema = z.object({
  sessionId: z.string().describe("Simulation session ID"),
});

export const SimulateDeleteInputSchema = z.object({
  sessionId: z.string().describe("Simulation session ID to terminate"),
});

export type SimulateDeployInput = z.infer<typeof SimulateDeployInputSchema>;
export type SimulateCallInput = z.infer<typeof SimulateCallInputSchema>;
export type SimulateStateInput = z.infer<typeof SimulateStateInputSchema>;
export type SimulateDeleteInput = z.infer<typeof SimulateDeleteInputSchema>;
