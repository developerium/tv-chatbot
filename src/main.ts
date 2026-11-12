import { Logger, StandardSchemaValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')

  // Validates every @Body/@Query/@Param that declares a Zod `schema`.
  app.useGlobalPipes(new StandardSchemaValidationPipe())

  const port = app.get(ConfigService).get<string>('PORT')
  if (!port) throw new Error('PORT environment variable is not set')

  await app.listen(port)
  Logger.log(`Listening on port ${port}`, 'Bootstrap')
}
await bootstrap()
