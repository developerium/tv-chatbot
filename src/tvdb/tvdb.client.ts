import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { HttpError } from '../common/http-error.js'
import { withRetry } from '../common/retry.js'
import { withoutQuery } from './without-query.js'

// HTTP access to TVDB: login, token refresh, timeouts and retries.
@Injectable()
export class TvdbClient {
  private readonly apiKey: string
  private readonly logger = new Logger(TvdbClient.name)
  private readonly baseUrl: string
  private readonly maxRetries: number
  private readonly pin: string
  private readonly timeoutMs: number
  private token?: Promise<string>

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('TVDB_API_KEY')
    const baseUrl = config.get<string>('TVDB_BASE_URL')
    const maxRetries = config.get<string>('TVDB_MAX_RETRIES')
    const pin = config.get<string>('TVDB_PIN')
    const timeoutMs = config.get<string>('TVDB_TIMEOUT_MS')

    // TVDB_PIN must be present but is empty for keys without a PIN.
    if (!apiKey || !baseUrl || !maxRetries || pin === undefined || !timeoutMs) {
      throw new Error(
        'TVDB_API_KEY, TVDB_BASE_URL, TVDB_MAX_RETRIES, TVDB_PIN and TVDB_TIMEOUT_MS must be set',
      )
    }

    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.maxRetries = Number(maxRetries)
    this.pin = pin
    this.timeoutMs = Number(timeoutMs)
  }

  // Returns the response's `data`. Path includes the query string.
  async get<T>(path: string, signal: AbortSignal): Promise<T> {
    return withRetry(() => this.getWithLogin<T>(path, signal), {
      maxRetries: this.maxRetries,
      name: `TVDB GET ${withoutQuery(path)}`,
      signal,
    })
  }

  private async getWithLogin<T>(path: string, signal: AbortSignal): Promise<T> {
    try {
      return await this.request<T>(path, await this.getToken(signal), signal)
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 401)) throw error

      // Expired token: log in once more; a second 401 is a config error.
      this.logger.warn('TVDB token rejected, logging in again')
      this.token = undefined

      return this.request<T>(path, await this.getToken(signal), signal)
    }
  }

  private getToken(signal: AbortSignal): Promise<string> {
    this.token ??= this.login(signal).catch((error: unknown) => {
      this.token = undefined
      throw error
    })

    return this.token
  }

  private async login(signal: AbortSignal): Promise<string> {
    const body = this.pin
      ? { apikey: this.apiKey, pin: this.pin }
      : { apikey: this.apiKey }

    const response = await fetch(`${this.baseUrl}/login`, {
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: this.withTimeout(signal),
    })

    const { token } = await this.readData<{ token: string }>(response)
    this.logger.log('Logged in to TVDB')

    return token
  }

  private async request<T>(
    path: string,
    token: string,
    signal: AbortSignal,
  ): Promise<T> {
    const startedAt = Date.now()
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: this.withTimeout(signal),
    })

    // No query string: search terms come from user text.
    this.logger.debug(
      `GET ${withoutQuery(path)} ${response.status} ${Date.now() - startedAt}ms`,
    )

    return this.readData<T>(response)
  }

  private async readData<T>(response: Response): Promise<T> {
    // 401 bodies are { message } only, without the usual envelope.
    const body = (await response.json().catch(() => ({}))) as {
      data?: T
      message?: string
    }

    if (!response.ok) {
      const retryAfter = Number(response.headers.get('retry-after'))

      throw new HttpError(
        response.status,
        `TVDB ${response.status}: ${body.message ?? response.statusText}`,
        retryAfter > 0 ? retryAfter * 1000 : undefined,
      )
    }

    return body.data as T
  }

  private withTimeout(signal: AbortSignal): AbortSignal {
    return AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)])
  }
}
