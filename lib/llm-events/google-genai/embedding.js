/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
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
    const { agent, request } = params
    this.input = agent.config?.ai_monitoring?.record_content?.enabled
      ? request?.contents
      : undefined
    this.error = params.isError
    this.duration = params.segment.getDurationInMillis()
    this.token_count = agent.llm?.tokenCountCallback?.(
      this['request.model'],
      request.input?.toString()
    )
  }
}

module.exports = LlmEmbedding
