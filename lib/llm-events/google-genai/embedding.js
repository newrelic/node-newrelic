/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEmbedding = require('../embedding')

/**
 * Encapsulates a Google Gen AI LlmEmbedding.
 */
module.exports = class GoogleGenAiLlmEmbedding extends LlmEmbedding {
  /**
   *
   * @param {object} params Constructor params
   * @param {Agent} params.agent New Relic agent instance
   * @param {TraceSegment} params.segment Current segment
   * @param {Transaction} params.transaction Current and active transaction
   * @param {object} params.request Google Gen AI request object
   * @param {object} params.response Google Gen AI response object
   * @param {boolean} [params.error] Set to true if an error occurred
   */
  constructor({ agent, segment, transaction, request = {}, response = {}, error }) {
    super({ agent,
      segment,
      transaction,
      requestInput: request?.contents,
      requestModel: request?.model,
      responseModel: response?.modelVersion,
      vendor: 'gemini',
      error })
  }
}
