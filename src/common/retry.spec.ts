import { HttpError } from './http-error.js'
import { withRetry } from './retry.js'

describe('withRetry', () => {
  const signal = new AbortController().signal

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retries a retryable status and returns the result', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new HttpError(429, 'Too many requests'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue('ok')

    await expect(
      withRetry(operation, { maxRetries: 3, name: 'test', signal }),
    ).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('does not retry other 4xx errors', async () => {
    const operation = vi.fn().mockRejectedValue(new HttpError(404, 'Not found'))

    await expect(
      withRetry(operation, { maxRetries: 3, name: 'test', signal }),
    ).rejects.toThrow('Not found')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('stops after the maximum number of retries', async () => {
    const operation = vi.fn().mockRejectedValue(new HttpError(503, 'Down'))

    await expect(
      withRetry(operation, { maxRetries: 2, name: 'test', signal }),
    ).rejects.toThrow('Down')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('fails at once when Retry-After is longer than the cap', async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new HttpError(429, 'Slow down', 60_000))

    await expect(
      withRetry(operation, { maxRetries: 3, name: 'test', signal }),
    ).rejects.toThrow('Slow down')
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('does not retry once the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const operation = vi.fn().mockRejectedValue(new HttpError(503, 'Down'))

    await expect(
      withRetry(operation, {
        maxRetries: 3,
        name: 'test',
        signal: controller.signal,
      }),
    ).rejects.toThrow('Down')
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
