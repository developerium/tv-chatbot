import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  Agent,
  type AgentInputItem,
  OpenAIProvider,
  Runner,
  system,
  user,
} from '@openai/agents'
import OpenAI from 'openai'

import type { MessageEntity } from '../storage/message.entity.js'
import type { TvdbRunContext } from '../tvdb/tvdb-entity.js'

import { entityKey } from '../tvdb/entity-key.js'
import { entityUrl } from '../tvdb/entity-url.js'
import { TvdbTools } from '../tvdb/tvdb.tools.js'
import { AGENT_INSTRUCTIONS } from './agent.instructions.js'
import { callIdOf } from './call-id-of.js'
import {
  type AgentReply,
  type FinalAnswer,
  finalAnswerSchema,
  NOT_GROUNDED_REPLY,
  OFF_TOPIC_REPLY,
} from './final-answer.js'
import { findSourceProblem } from './find-source-problem.js'
import { toAgentInput } from './to-agent-input.js'

@Injectable()
export class AgentService {
  private readonly agent: Agent<TvdbRunContext, typeof finalAnswerSchema>
  private readonly historyLimit: number
  private readonly logger = new Logger(AgentService.name)
  private readonly maxTurns: number
  private readonly runner: Runner

  constructor(config: ConfigService, tvdbTools: TvdbTools) {
    const apiKey = config.get<string>('OPENAI_API_KEY')
    const historyLimit = config.get<string>('AGENT_HISTORY_LIMIT')
    const maxRetries = config.get<string>('OPENAI_MAX_RETRIES')
    const maxTurns = config.get<string>('AGENT_MAX_TURNS')
    const model = config.get<string>('OPENAI_MODEL')
    const timeout = config.get<string>('OPENAI_TIMEOUT_MS')

    if (
      !apiKey ||
      !historyLimit ||
      !maxRetries ||
      !maxTurns ||
      !model ||
      !timeout
    ) {
      throw new Error(
        'AGENT_HISTORY_LIMIT, AGENT_MAX_TURNS, OPENAI_API_KEY, OPENAI_MAX_RETRIES, OPENAI_MODEL and OPENAI_TIMEOUT_MS must be set',
      )
    }

    const client = new OpenAI({
      apiKey,
      maxRetries: Number(maxRetries),
      timeout: Number(timeout),
    })

    this.agent = new Agent<TvdbRunContext, typeof finalAnswerSchema>({
      instructions: AGENT_INSTRUCTIONS,
      name: 'TV series recommendation agent',
      outputType: finalAnswerSchema,
      tools: tvdbTools.tools,
    })
    this.historyLimit = Number(historyLimit)
    this.maxTurns = Number(maxTurns)
    this.runner = new Runner({
      model,
      modelProvider: new OpenAIProvider({ openAIClient: client }),
      // Traces would send chat text to OpenAI's dashboard.
      tracingDisabled: true,
    })

    // One line per tool call: name, duration and result size, never content.
    const toolStarts = new Map<string, number>()
    this.runner.on(
      'agent_tool_start',
      (_context, _agent, _tool, { toolCall }) => {
        toolStarts.set(callIdOf(toolCall), Date.now())
      },
    )
    this.runner.on(
      'agent_tool_end',
      (_context, _agent, tool, result, { toolCall }) => {
        const callId = callIdOf(toolCall)
        const durationMs = Date.now() - (toolStarts.get(callId) ?? Date.now())
        toolStarts.delete(callId)

        this.logger.log(
          `Tool ${tool.name}: ${durationMs}ms, ${result.length} characters`,
        )
      },
    )
  }

  // Answers `message` given the chat's earlier messages, oldest first.
  async chat(
    history: MessageEntity[],
    message: string,
    signal: AbortSignal,
  ): Promise<AgentReply> {
    const recentHistory = history.slice(-this.historyLimit)
    const context: TvdbRunContext = { seenEntities: new Map() }

    // Entities cited in earlier answers came from TVDB too, so follow-ups
    // may cite them again without a new lookup.
    for (const { sources = [] } of recentHistory) {
      for (const { name, tvdbId, type } of sources) {
        context.seenEntities.set(entityKey(type, tvdbId), {
          id: tvdbId,
          name,
          type,
        })
      }
    }

    const input = [...recentHistory.map(toAgentInput), user(message)]
    const firstRun = await this.run(input, context, signal)
    let answer = firstRun.answer

    // Sources the tools never returned go back to the model once to fix.
    let problem = findSourceProblem(answer, context)
    if (problem) {
      this.logger.warn(
        `Answer not grounded, asking for a correction: ${problem}`,
      )

      const correction = system(
        `${problem}. Only cite entities from TVDB tool results in this conversation, look them up first, or answer with kind "not_found".`,
      )

      ;({ answer } = await this.run(
        [...firstRun.history, correction],
        context,
        signal,
      ))
      problem = findSourceProblem(answer, context)
    }

    if (problem) {
      this.logger.warn(
        `Answer still not grounded, replying not_found: ${problem}`,
      )

      return { kind: 'not_found', message: NOT_GROUNDED_REPLY, sources: [] }
    }

    // Model-written text never goes out for off-topic requests.
    if (answer.kind === 'off_topic') {
      this.logger.log('Off-topic request, sending the fixed reply')

      return { kind: 'off_topic', message: OFF_TOPIC_REPLY, sources: [] }
    }

    return {
      kind: answer.kind,
      message: answer.message,
      sources: answer.sources.map((source) => {
        const entity = context.seenEntities.get(
          entityKey(source.type, source.id),
        )!

        return { ...entity, url: entityUrl(entity) }
      }),
    }
  }

  private async run(
    input: AgentInputItem[] | string,
    context: TvdbRunContext,
    signal: AbortSignal,
  ): Promise<{ answer: FinalAnswer; history: AgentInputItem[] }> {
    const startedAt = Date.now()
    const result = await this.runner.run(this.agent, input, {
      context,
      maxTurns: this.maxTurns,
      signal,
    })

    const usage = result.runContext?.usage
    this.logger.log(
      `Run finished: ${result.rawResponses?.length ?? 0} model calls, ${usage?.inputTokens ?? 0} input and ${usage?.outputTokens ?? 0} output tokens, ${Date.now() - startedAt}ms`,
    )

    if (!result.finalOutput) {
      throw new Error('Agent finished without a final answer')
    }

    return { answer: result.finalOutput, history: result.history }
  }
}
