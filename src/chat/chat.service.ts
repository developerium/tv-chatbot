import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'

import type { Paginated } from '../common/pagination/paginated.js'
import type { PaginationQueryDto } from '../common/pagination/pagination-query.dto.js'
import type { ChatEntity, ChatSummaryEntity } from '../storage/chat.entity.js'
import type { MessageEntity } from '../storage/message.entity.js'
import type { MessageExchange } from './message-exchange.js'
import type { SendMessageDto } from './send-message.dto.js'

import { AgentService } from '../agent/agent.service.js'
import {
  CHAT_REPOSITORY,
  type ChatRepository,
} from '../storage/chat.repository.js'
import { AssistantUnavailableError } from './assistant-unavailable.error.js'
import { TurnTimeoutError } from './turn-timeout.error.js'

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly turnTimeoutMs: number

  constructor(
    @Inject(CHAT_REPOSITORY) private readonly chatRepository: ChatRepository,
    private readonly agentService: AgentService,
    config: ConfigService,
  ) {
    const turnTimeoutMs = config.get<string>('AGENT_TURN_TIMEOUT_MS')
    if (!turnTimeoutMs) throw new Error('AGENT_TURN_TIMEOUT_MS must be set')

    this.turnTimeoutMs = Number(turnTimeoutMs)
  }

  async createChat(userId: string): Promise<ChatEntity> {
    const chat = await this.chatRepository.create(userId)
    this.logger.log(`Created chat ${chat.id}`)

    return chat
  }

  // The user's chats without messages, newest first.
  async listChats(
    userId: string,
    page: PaginationQueryDto,
  ): Promise<Paginated<ChatSummaryEntity>> {
    return this.chatRepository.listByUser(userId, page)
  }

  // A chat with all its messages. Returns null if the user has no such chat.
  async getChat(chatId: string, userId: string): Promise<ChatEntity | null> {
    return this.chatRepository.findById(chatId, userId)
  }

  // Runs one agent turn. Returns null if the user has no such chat.
  // A repeated clientId returns the saved answer instead of a new turn.
  async sendMessage(
    chatId: string,
    userId: string,
    { clientId, text }: SendMessageDto,
  ): Promise<MessageExchange | null> {
    const chat = await this.chatRepository.findById(chatId, userId)
    if (!chat) return null

    // Length only: chat text never goes into logs.
    this.logger.log(
      `Message for chat ${chatId}: ${text.length} characters${clientId ? `, clientId ${clientId}` : ''}`,
    )

    const previous = clientId
      ? chat.messages.find((message) => message.clientId === clientId)
      : undefined

    if (previous) {
      const answer = chat.messages.find(
        (message) => message.replyTo === previous.id,
      )
      if (answer) {
        this.logger.log(
          `Repeated clientId ${clientId}, returning the saved answer`,
        )

        return { assistantMessage: answer, userMessage: previous }
      }

      // The earlier turn failed: answer the saved question again.
      this.logger.log(
        `Repeated clientId ${clientId}, answering the saved question again`,
      )
      const history = chat.messages.slice(0, chat.messages.indexOf(previous))

      return this.answer(chat, previous, history)
    }

    // Saved before the turn, so it is kept even if the turn fails.
    const userMessage: MessageEntity = {
      clientId,
      createdAt: new Date(),
      id: randomUUID(),
      role: 'user',
      status: 'complete',
      text,
    }
    const chatWithQuestion = await this.chatRepository.addMessages(chat, [
      userMessage,
    ])

    return this.answer(chatWithQuestion, userMessage, chat.messages)
  }

  // Runs the agent for `userMessage` and saves its answer to `chat`.
  private async answer(
    chat: ChatEntity,
    userMessage: MessageEntity,
    history: MessageEntity[],
  ): Promise<MessageExchange> {
    const startedAt = Date.now()
    const signal = AbortSignal.timeout(this.turnTimeoutMs)

    const reply = await this.agentService
      .chat(history, userMessage.text, signal)
      .catch((error: unknown) => {
        if (signal.aborted) {
          this.logger.warn(
            `Agent turn in chat ${chat.id} hit the ${this.turnTimeoutMs}ms deadline`,
          )
          throw new TurnTimeoutError()
        }

        // Error name and message only: no chat text in logs.
        const { message, name } =
          error instanceof Error ? error : new Error(String(error))
        this.logger.error(
          `Agent turn failed in chat ${chat.id}: ${name}: ${message}`,
        )

        throw new AssistantUnavailableError()
      })

    const assistantMessage: MessageEntity = {
      createdAt: new Date(),
      id: randomUUID(),
      kind: reply.kind,
      replyTo: userMessage.id,
      role: 'assistant',
      sources: reply.sources.map(({ id, name, type, url }) => ({
        name,
        tvdbId: id,
        type,
        url,
      })),
      status: 'complete',
      text: reply.message,
    }
    await this.chatRepository.addMessages(chat, [assistantMessage])

    this.logger.log(
      `Answered in chat ${chat.id}: kind ${reply.kind}, ${reply.sources.length} sources, ${Date.now() - startedAt}ms`,
    )

    return { assistantMessage, userMessage }
  }
}
