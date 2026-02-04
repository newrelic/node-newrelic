/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEmbedding = require('../embedding')

/**
 * Encapsulates a AWS Bedrock LlmEmbedding event.
 */
module.exports = class AwsBedrockLlmEmbedding extends LlmEmbedding {
  /**
   *
   * @param {object} params constructor parameters
   * @param {Agent} params.agent New Relic agent instance
   * @param {object} params.segment Current segment
   * @param {object} params.transaction Current and active transaction
   * @param {string} params.requestInput Input to the embedding creation call
   * @param {object} params.bedrockCommand AWS Bedrock Command object, represents the request
   * @param {object} params.bedrockResponse AWS Bedrock Response object
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call
   *  - omitted if no error occurred
   */
  constructor({ agent, segment, transaction, requestInput, bedrockCommand, bedrockResponse, error }) {
    super({ agent,
      segment,
      transaction,
      vendor: 'bedrock',
      requestId: bedrockResponse?.requestId,
      requestInput,
      requestModel: bedrockCommand?.modelId,
      responseModel: bedrockCommand?.modelId, // we can assume requestModel==responseModel in bedrock
      error })

    this.setTotalTokens({ agent, input: requestInput, totalTokenCount: bedrockResponse?.totalTokenCount })
  }

  setTotalTokens({ agent, input, totalTokenCount }) {
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

    this.setTokensOnEmbeddingMessage(totalTokenCount)
  }
}
