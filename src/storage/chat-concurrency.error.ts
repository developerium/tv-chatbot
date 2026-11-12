// The chat changed since it was read, e.g. a double submit; reload and retry.
export class ChatConcurrencyError extends Error {
  constructor(chatId: string) {
    super(`Chat ${chatId} was changed by another request`)
  }
}
