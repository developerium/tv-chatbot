import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { ChatRepository } from './chat.repository.js'
import { ChatDocument, ChatSchema } from './chat.schema.js'

@Module({
  exports: [ChatRepository],
  imports: [
    MongooseModule.forFeature([
      { name: ChatDocument.name, schema: ChatSchema },
    ]),
  ],
  providers: [ChatRepository],
})
export class StorageModule {}
