/**
 * Fetch wrapper with timeout support.
 * Applies AbortSignal.timeout to prevent upstream hangs from blocking workers.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fetch with a bounded timeout. Throws on timeout just like a network error,
 * so callers can catch uniformly.
 *
 * If the caller also provides a `signal` in `init`, both signals are combined
 * via `AbortSignal.any()` so either can abort the request.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

  return fetch(input, {
    ...init,
    signal,
  });
}
