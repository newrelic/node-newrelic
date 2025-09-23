/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEvent = require('./event')
const { setUsageTokens } = require('./utils')

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

    setUsageTokens(params.bedrockResponse, this)
  }
}

module.exports = LlmEmbedding
