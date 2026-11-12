import { Logger } from '@nestjs/common'

import { HttpError } from '../common/http-error.js'
import { TvdbLookupError } from './tvdb-lookup.error.js'

const logger = new Logger('TvdbTools')

// What the model sees when a tool fails; never raw errors or stack traces.
export function describeToolError(
  _context: unknown,
  error: unknown,
  details?: { toolCall?: { name?: string } },
): string {
  const tool = details?.toolCall?.name ?? 'tool'
  const reason =
    error instanceof HttpError
      ? `status ${error.status}`
      : (error as Error).name
  logger.warn(`${tool} failed: ${reason}`)

  if (error instanceof TvdbLookupError) return error.message

  if (error instanceof HttpError && error.status === 404) {
    return 'TVDB has no record with this id.'
  }

  if (error instanceof HttpError && error.status === 400) {
    return 'TVDB rejected the request. Check the arguments.'
  }

  return 'TVDB is temporarily unavailable.'
}
