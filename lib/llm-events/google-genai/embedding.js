/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const LlmEmbedding = require('../embedding')

/**
 * Encapsulates a Google Gen AI LlmEmbedding.
 */
class GoogleGenAiLlmEmbedding extends LlmEmbedding {
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

module.exports = GoogleGenAiLlmEmbedding
