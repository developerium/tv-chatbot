import type { protocol } from '@openai/agents'

// The id that pairs a tool call's start and end events.
export function callIdOf(toolCall: protocol.ToolCallItem): string {
  return 'callId' in toolCall ? toolCall.callId : (toolCall.id ?? '')
}
