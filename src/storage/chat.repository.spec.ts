import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'

import type { ChatRepository } from './chat.repository.js'
import type { MessageEntity } from './message.entity.js'

import { ChatConcurrencyError } from './chat-concurrency.error.js'
import { ChatDocument, ChatSchema } from './chat.schema.js'
import { InMemoryChatRepository } from './in-memory-chat.repository.js'
import { MongoChatRepository } from './mongo-chat.repository.js'

// Set MONGODB_TEST_URI (e.g. mongodb://user:password@127.0.0.1:27017/?authSource=admin)
// to also run the contract against a real MongoDB.
const mongoUri = process.env.MONGODB_TEST_URI

const userMessage: MessageEntity = {
  createdAt: new Date('2026-11-09T10:00:00Z'),
  id: 'message-1',
  role: 'user',
  status: 'complete',
  text: 'Something like Breaking Bad?',
}
const assistantMessage: MessageEntity = {
  createdAt: new Date('2026-11-09T10:00:05Z'),
  id: 'message-2',
  kind: 'answer',
  replyTo: 'message-1',
  role: 'assistant',
  sources: [
    {
      name: 'Better Call Saul',
      tvdbId: 273_181,
      type: 'series',
      url: 'https://thetvdb.com/dereferrer/series/273181',
    },
  ],
  status: 'complete',
  text: 'Try Better Call Saul.',
}

function describeContract(
  name: string,
  createRepository: () => Promise<ChatRepository>,
) {
  describe(name, () => {
    let repository: ChatRepository

    beforeEach(async () => {
      repository = await createRepository()
    })

    it('creates an empty chat for a user', async () => {
      const chat = await repository.create('user-1')

      expect(chat).toMatchObject({ messages: [], userId: 'user-1', version: 0 })
      expect(chat.id).toEqual(expect.any(String))
      expect(chat).not.toHaveProperty('_id')
    })

    it('finds a chat only for its owner', async () => {
      const chat = await repository.create('user-1')

      await expect(repository.findById(chat.id, 'user-1')).resolves.toEqual(
        chat,
      )
      await expect(repository.findById(chat.id, 'user-2')).resolves.toBeNull()
      await expect(repository.findById('unknown', 'user-1')).resolves.toBeNull()
    })

    it('appends messages and increments the version', async () => {
      const chat = await repository.create('user-1')

      const updated = await repository.addMessages(chat, [
        userMessage,
        assistantMessage,
      ])

      expect(updated.version).toBe(1)
      expect(updated.messages).toEqual([userMessage, assistantMessage])
      await expect(repository.findById(chat.id, 'user-1')).resolves.toEqual(
        updated,
      )
    })

    it('rejects a save based on an old version', async () => {
      const chat = await repository.create('user-1')
      await repository.addMessages(chat, [userMessage])

      await expect(
        repository.addMessages(chat, [assistantMessage]),
      ).rejects.toThrow(ChatConcurrencyError)
    })
  })
}

describeContract(
  'InMemoryChatRepository',
  async () => new InMemoryChatRepository(),
)

describe.skipIf(!mongoUri)('MongoChatRepository', () => {
  const connection = mongoose.createConnection()

  beforeAll(async () => {
    await connection.openUri(mongoUri!, { dbName: `test-${randomUUID()}` })
  })

  afterAll(async () => {
    await connection.dropDatabase()
    await connection.close()
  })

  describeContract(
    'contract',
    async () =>
      new MongoChatRepository(connection.model(ChatDocument.name, ChatSchema)),
  )
})
