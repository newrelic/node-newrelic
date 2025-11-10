/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')

/**
 * @typedef {object} LlmEmbeddingParams
 * @augments LlmEventParams
 * @property {string} input - The input message for the embedding call
 */
/**
 * @type {LlmEmbeddingParams}
 */
const defaultParams = {}

class LlmEmbedding extends LlmEvent {
  constructor(params = defaultParams) {
    super(params)
    const { agent, input } = params

    this.input = agent.config?.ai_monitoring?.record_content?.enabled
      ? input
      : undefined
    this.error = params.isError
    this.duration = params.segment.getDurationInMillis()

    this.setTotalTokens(agent, input)
  }

  setTotalTokens(agent, input) {
    const tokenCB = agent?.llm?.tokenCountCallback

    // For embedding events, only total token count is relevant.
    // Prefer callback for total tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const content = input?.toString()

      if (content === undefined) {
        return
      }

      const totalTokens = this.calculateCallbackTokens(tokenCB, this['request.model'], content)
      this.setTokensOnEmbeddingMessage(totalTokens)
      return
    }

    this.setTokensOnEmbeddingMessage(this.bedrockResponse.inputTokenCount)
  }
}

module.exports = LlmEmbedding
