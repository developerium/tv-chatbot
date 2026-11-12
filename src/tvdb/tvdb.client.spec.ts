import { ConfigService } from '@nestjs/config'

import { HttpError } from '../common/http-error.js'
import { TvdbClient } from './tvdb.client.js'

const environment = {
  TVDB_API_KEY: 'test-key',
  TVDB_BASE_URL: 'https://tvdb.test/v4',
  TVDB_MAX_RETRIES: '0',
  TVDB_PIN: '',
  TVDB_TIMEOUT_MS: '5000',
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status })
}

describe('TvdbClient', () => {
  const signal = new AbortController().signal
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([
    'TVDB_API_KEY',
    'TVDB_BASE_URL',
    'TVDB_MAX_RETRIES',
    'TVDB_TIMEOUT_MS',
  ])('throws when %s is missing', (name) => {
    const config = new ConfigService({ ...environment, [name]: '' })

    expect(() => new TvdbClient(config)).toThrow('must be set')
  })

  it('logs in once without a PIN and returns data', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'token-1' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 1 } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 2 } }))
    const client = new TvdbClient(new ConfigService(environment))

    await expect(client.get('/series/1', signal)).resolves.toEqual({ id: 1 })
    await expect(client.get('/series/2', signal)).resolves.toEqual({ id: 2 })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1].body).toBe('{"apikey":"test-key"}')
    expect(fetchMock.mock.calls[1][1].headers).toEqual({
      Authorization: 'Bearer token-1',
    })
  })

  it('logs in again once on 401 and retries the request', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'old' } }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'new' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 1 } }))
    const client = new TvdbClient(new ConfigService(environment))

    await expect(client.get('/series/1', signal)).resolves.toEqual({ id: 1 })
    expect(fetchMock.mock.calls[3][1].headers).toEqual({
      Authorization: 'Bearer new',
    })
  })

  it('throws an HttpError with the status for failures', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { data: { token: 'token' } }))
      .mockResolvedValueOnce(
        jsonResponse(404, { message: 'NotFoundException', status: 'failure' }),
      )
    const client = new TvdbClient(new ConfigService(environment))

    const error = await client
      .get<never>('/series/0', signal)
      .catch((caught: unknown) => caught as HttpError)

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(404)
  })
})
