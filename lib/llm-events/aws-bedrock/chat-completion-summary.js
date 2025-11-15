/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')

/**
 * @typedef {object} LlmChatCompletionSummaryParams
 * @augments LlmEventParams
 * @property {string} segment the segment associated with this LlmChatCompletionSummary
 * @property {boolean} isError whether this event represents an error
 */
/**
 * @type {LlmChatCompletionSummaryParams}
 */
const defaultParams = {}

/**
 * Represents an LLM chat completion summary.
 */
class LlmChatCompletionSummary extends LlmEvent {
  constructor(params = defaultParams) {
    super(params)

    const { segment, isError, agent } = params
    this.error = isError
    this.duration = segment.getDurationInMillis()

    const cmd = this.bedrockCommand
    const res = this.bedrockResponse

    this['request.max_tokens'] = cmd.maxTokens
    this['response.choices.finish_reason'] = res.finishReason
    this['request.temperature'] = cmd.temperature
    this['response.number_of_messages'] = (cmd.prompt.length ?? 0) + (res.completions.length ?? 0)

    this.setTokens(agent)
  }

  setTokens(agent) {
    const tokenCB = agent?.llm?.tokenCountCallback

    // Prefer callback for prompt and completion tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const promptContent = this.bedrockCommand?.prompt?.map((msg) => msg.content).join(' ')
      const completionContent = this.bedrockResponse?.completions?.join(' ')

      this.setTokenUsageFromCallback(
        {
          tokenCB,
          reqModel: this.bedrockCommand.modelId,
          resModel: this.bedrockCommand.modelId,
          promptContent,
          completionContent
        }
      )
      return
    }

    this.setTokensInResponse({ promptTokens: this.bedrockResponse.inputTokenCount, completionTokens: this.bedrockResponse.outputTokenCount, totalTokens: this.bedrockResponse.totalTokenCount })
  }
}

module.exports = LlmChatCompletionSummary
