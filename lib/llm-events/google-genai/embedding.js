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
    // see: https://ai.google.dev/api/embeddings#v1beta.ContentEmbedding

    this.input = agent.config?.ai_monitoring?.record_content?.enabled
      ? request?.contents
      : undefined
    this.error = params.isError
    this.duration = params.segment.getDurationInMillis()
    // TODO: idk if this is correct for token count
    this.token_count = Array.isArray(params.response?.embeddings)
      ? params.response.embeddings.reduce((sum, e) => sum + (e?.values?.length || 0), 0)
      : undefined
  }
}

module.exports = LlmEmbedding
