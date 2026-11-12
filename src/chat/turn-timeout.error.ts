// The agent turn hit AGENT_TURN_TIMEOUT_MS before it could answer.
export class TurnTimeoutError extends Error {
  constructor() {
    super('This took too long, please try again or narrow the question.')
  }
}
