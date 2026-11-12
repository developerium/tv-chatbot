import type { Response } from 'express'

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common'

// Registered as APP_FILTER. HTTP exceptions the app throws on purpose
// (400, 404, 503, ...) pass through; anything else becomes a generic 500,
// so error details, stack traces or upstream responses never reach clients.
@Catch()
export class InternalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(InternalErrorFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse())
      return
    }

    // Stack only: the full error object can hold headers, ids or cookies.
    const error =
      exception instanceof Error ? exception : new Error(String(exception))
    this.logger.error(error.stack ?? `${error.name}: ${error.message}`)

    response
      .status(500)
      .json({ message: 'Internal server error', statusCode: 500 })
  }
}
