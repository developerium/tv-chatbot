// The SDK always passes the run's signal; the fallback only satisfies the types.
export function toolSignal(details?: { signal?: AbortSignal }): AbortSignal {
  return details?.signal ?? new AbortController().signal
}
