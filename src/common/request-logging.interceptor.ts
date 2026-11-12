import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common'

// Registered as APP_INTERCEPTOR: one line per controller call with the
// route pattern, status and duration. Never bodies or query strings.
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>()
    const response = context.switchToHttp().getResponse<Response>()
    const startedAt = Date.now()

    // 'finish' also fires for error responses written by the exception filter.
    response.once('finish', () => {
      const route = (request.route as undefined | { path: string })?.path
      const durationMs = Date.now() - startedAt

      this.logger.log(
        `${request.method} ${route ?? request.path} ${response.statusCode} ${durationMs}ms`,
      )
    })

    return next.handle()
  }
}
