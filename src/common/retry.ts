import { Logger } from '@nestjs/common'
import { setTimeout as sleep } from 'node:timers/promises'

import { HttpError } from './http-error.js'

// Backoff starting values from ARCHITECTURE.md (Rate limiting and retries).
const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 8000
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])

const logger = new Logger('Retry')

export interface RetryOptions {
  maxRetries: number
  // Names the outbound service in retry logs, e.g. "TVDB GET /series/{id}".
  name: string
  signal: AbortSignal
}

// Retries 429, 5xx, timeouts and network errors with full-jitter backoff.
export async function withRetry<T>(
  operation: () => Promise<T>,
  { maxRetries, name, signal }: RetryOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const delay = retryDelay(error, attempt)
      const canRetry = !signal.aborted && attempt < maxRetries

      if (!canRetry || delay === undefined) throw error

      const reason =
        error instanceof HttpError
          ? `status ${error.status}`
          : (error as Error).name
      logger.warn(
        `${name}: retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms after ${reason}`,
      )

      await sleep(delay, undefined, { signal })
    }
  }
}

function retryDelay(error: unknown, attempt: number): number | undefined {
  if (error instanceof HttpError) {
    if (!RETRYABLE_STATUSES.has(error.status)) return undefined

    // A Retry-After longer than the cap fails now instead of blocking the turn.
    if (error.retryAfterMs !== undefined) {
      return error.retryAfterMs <= MAX_DELAY_MS ? error.retryAfterMs : undefined
    }
  } else if (!isNetworkOrTimeoutError(error)) {
    return undefined
  }

  return Math.random() * Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)
}

function isNetworkOrTimeoutError(error: unknown): boolean {
  // fetch throws TypeError on network failures; AbortSignal.timeout throws TimeoutError.
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'TimeoutError')
  )
}
