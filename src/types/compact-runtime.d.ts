/**
 * Ambient type declarations for @midnight-ntwrk/compact-runtime.
 *
 * This package is an optional runtime dependency that may not be installed.
 * All usages are wrapped in try/catch to gracefully degrade when absent.
 */
declare module "@midnight-ntwrk/compact-runtime" {
  export interface ZswapLocalState {
    coinPublicKey: string;
  }

  export interface CircuitContext {
    [key: string]: unknown;
  }

  // eslint-disable-next-line @typescript-eslint/no-extraneous-class -- external API; class is instantiated via `new ContractState()`
  export class ContractState {
    constructor();
  }

  export function emptyZswapLocalState(coinPublicKey: string): ZswapLocalState;

  export function createConstructorContext(
    state: Record<string, unknown>,
    coinPublicKey: string,
  ): CircuitContext;

  export function createCircuitContext(
    contractAddress: unknown,
    zswapState: ZswapLocalState,
    contractState: ContractState,
    privateState: Record<string, unknown>,
    gasLimit?: unknown,
    costModel?: unknown,
    time?: unknown,
  ): CircuitContext;

  export function dummyContractAddress(): unknown;
}
