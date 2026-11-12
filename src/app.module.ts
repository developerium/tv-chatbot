import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { MongooseModule } from '@nestjs/mongoose'

import { AgentModule } from './agent/agent.module.js'
import { ChatModule } from './chat/chat.module.js'
import { AuthGuard } from './common/auth.guard.js'
import { InternalErrorFilter } from './common/internal-error.filter.js'
import { RequestLoggingInterceptor } from './common/request-logging.interceptor.js'
import { createMongoOptions } from './storage/mongo-connection.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // One shared connection; startup fails if MongoDB can't be reached.
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createMongoOptions,
    }),
    AgentModule,
    ChatModule,
  ],
  providers: [
    // Every route requires authentication.
    { provide: APP_GUARD, useClass: AuthGuard },
    // Unexpected errors return a generic 500 without details.
    { provide: APP_FILTER, useClass: InternalErrorFilter },
    // Logs method, route, status and duration of every request.
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
