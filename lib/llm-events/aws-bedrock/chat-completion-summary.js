/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')
const { setUsageTokens, calculateCallbackTokens, setTokensInResponse } = require('./utils')
const { validCallbackTokenCount } = require('../utils')
/**
 * @typedef {object} LlmChatCompletionSummaryParams
 * @augments LlmEventParams
 * @property
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
    const tokenCB = agent.llm?.tokenCountCallback

    // Prefer callback for prompt and completion tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const promptContent = this.bedrockCommand.prompt?.[0]?.content
      const completionContent = this.bedrockResponse.completions?.[0]

      const promptToken = calculateCallbackTokens(tokenCB, this.bedrockCommand.modelId, promptContent)
      const completionToken = calculateCallbackTokens(tokenCB, this.bedrockCommand.modelId, completionContent)

      const hasValidCallbackCounts =
        validCallbackTokenCount(promptToken) && validCallbackTokenCount(completionToken)

      if (hasValidCallbackCounts) {
        setTokensInResponse(this, { promptToken, completionToken, totalToken: promptToken + completionToken })
        return
      }
    }
    setUsageTokens(agent, this.bedrockCommand, this.bedrockResponse, this)
  }
}

module.exports = LlmChatCompletionSummary
