import {
  Body,
  ConflictException,
  Controller,
  GatewayTimeoutException,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common'

import type { ChatCreatedDto } from './chat-created.dto.js'
import type { MessageSentDto } from './message-sent.dto.js'

import { UserId } from '../common/user-id.decorator.js'
import { ChatConcurrencyError } from '../storage/chat-concurrency.error.js'
import { AssistantUnavailableError } from './assistant-unavailable.error.js'
import { chatIdSchema } from './chat-id.schema.js'
import { ChatService } from './chat.service.js'
import { type SendMessageDto, sendMessageSchema } from './send-message.dto.js'
import { toMessageDto } from './to-message-dto.js'
import { TurnTimeoutError } from './turn-timeout.error.js'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Creates an empty chat owned by the current user.
  @Post()
  async createChat(@UserId() userId: string): Promise<ChatCreatedDto> {
    const chat = await this.chatService.createChat(userId)

    return { createdAt: chat.createdAt.toISOString(), id: chat.id }
  }

  // Runs one agent turn and returns the saved question and answer.
  @Post(':id/message')
  async sendMessage(
    @Param('id', { schema: chatIdSchema }) chatId: string,
    @Body({ schema: sendMessageSchema }) body: SendMessageDto,
    @UserId() userId: string,
  ): Promise<MessageSentDto> {
    const result = await this.chatService
      .sendMessage(chatId, userId, body)
      .catch((error: unknown) => {
        if (error instanceof TurnTimeoutError) {
          throw new GatewayTimeoutException(error.message)
        }
        if (error instanceof AssistantUnavailableError) {
          throw new ServiceUnavailableException(error.message)
        }
        if (error instanceof ChatConcurrencyError) {
          throw new ConflictException(
            'The chat changed while answering, please send the message again.',
          )
        }

        throw error
      })

    // Unknown chats and other users' chats look the same.
    if (!result) throw new NotFoundException('Chat not found')

    return {
      assistantMessage: toMessageDto(result.assistantMessage),
      userMessage: toMessageDto(result.userMessage),
    }
  }
}
