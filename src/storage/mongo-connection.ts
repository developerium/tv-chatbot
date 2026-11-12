import type { ConfigService } from '@nestjs/config'
import type { MongooseModuleOptions } from '@nestjs/mongoose'

// Connection options from MONGODB_* settings; the root user lives in "admin".
export function createMongoOptions(
  config: ConfigService,
): MongooseModuleOptions {
  const database = config.get<string>('MONGODB_DATABASE')
  const host = config.get<string>('MONGODB_HOST')
  const password = config.get<string>('MONGODB_PASSWORD')
  const port = config.get<string>('MONGODB_PORT')
  const timeoutMs = config.get<string>('MONGODB_TIMEOUT_MS')
  const username = config.get<string>('MONGODB_USERNAME')

  if (!database || !host || !password || !port || !timeoutMs || !username) {
    throw new Error(
      'MONGODB_DATABASE, MONGODB_HOST, MONGODB_PASSWORD, MONGODB_PORT, MONGODB_TIMEOUT_MS and MONGODB_USERNAME must be set',
    )
  }

  return {
    authSource: 'admin',
    dbName: database,
    pass: password,
    // Fail startup on the first failed connection instead of retrying.
    retryAttempts: 0,
    serverSelectionTimeoutMS: Number(timeoutMs),
    socketTimeoutMS: Number(timeoutMs),
    uri: `mongodb://${host}:${port}`,
    user: username,
  }
}
