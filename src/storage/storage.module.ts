import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { CHAT_REPOSITORY } from './chat.repository.js'
import { ChatDocument, ChatSchema } from './chat.schema.js'
import { MongoChatRepository } from './mongo-chat.repository.js'

@Module({
  exports: [CHAT_REPOSITORY],
  imports: [
    MongooseModule.forFeature([
      { name: ChatDocument.name, schema: ChatSchema },
    ]),
  ],
  providers: [{ provide: CHAT_REPOSITORY, useClass: MongoChatRepository }],
})
export class StorageModule {}
