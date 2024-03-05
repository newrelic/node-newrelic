/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')

/**
 * @typedef {object} LlmEmbeddingParams
 * @augments LlmEventParams
 */
/**
 * @type {LlmEmbeddingParams}
 */
const defaultParams = {}

class LlmEmbedding extends LlmEvent {
  constructor(params = defaultParams) {
    super(params)
    const { agent } = params

    this.input = agent.config?.ai_monitoring?.record_content?.enabled
      ? this.bedrockCommand.prompt
      : undefined
    this.error = params.isError
    this.duration = params.segment.getDurationInMillis()
    this['response.usage.total_tokens'] = this.bedrockResponse.inputTokenCount
    this['response.usage.prompt_tokens'] = this.bedrockResponse.inputTokenCount
    this.token_count = this.bedrockResponse.inputTokenCount
  }
}

module.exports = LlmEmbedding
