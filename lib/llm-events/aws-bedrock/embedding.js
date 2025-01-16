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
    const tokenCb = agent?.llm?.tokenCountCallback

    this.input = agent.config?.ai_monitoring?.record_content?.enabled
      ? input
      : undefined
    this.error = params.isError
    this.duration = params.segment.getDurationInMillis()

    // Even if not recording content, we should use the local token counting callback to record token usage
    if (typeof tokenCb === 'function') {
      this.token_count = tokenCb(this.bedrockCommand.modelId, input)
    }
  }
}

module.exports = LlmEmbedding
