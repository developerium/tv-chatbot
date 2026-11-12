// An HTTP response with an error status, for the retry helper and callers.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message)
  }
}
