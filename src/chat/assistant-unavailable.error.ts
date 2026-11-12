// The agent turn failed for a reason other than the deadline, e.g. the
// OpenAI API is down or rejects the request.
export class AssistantUnavailableError extends Error {
  constructor() {
    super('The assistant is unavailable right now, please try again later.')
  }
}
