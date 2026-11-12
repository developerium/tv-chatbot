import { Module } from '@nestjs/common'

import { AgentModule } from '../agent/agent.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { ChatController } from './chat.controller.js'
import { ChatService } from './chat.service.js'

@Module({
  controllers: [ChatController],
  imports: [AgentModule, StorageModule],
  providers: [ChatService],
})
export class ChatModule {}
