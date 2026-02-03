/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

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
   * @param {string} params.requestId ID associated with the request - typically available in response headers
   * @param {string} params.requestInput Input to the embedding creation call
   * @param {string} params.requestModel Model name specified in the request (e.g. 'gpt-4')
   * @param {number} params.totalTokenCount Retrieved from the Bedrock response object, fallback for token calculation
   * @param {boolean} [params.error] Set to `true` if an error occurred during creation call - omitted if no error occurred
   */
  constructor({ agent, segment, transaction, requestInput, requestModel, requestId, totalTokenCount = 0, error }) {
    super({ agent,
      segment,
      transaction,
      vendor: 'bedrock',
      requestInput,
      requestModel,
      requestId,
      responseModel: requestModel, // we can assume this in bedrock
      error })

    this.appName = agent.config.applications()[0] // TODO: still required?
    this.setTotalTokens(agent, requestInput, totalTokenCount)
    // TODO: bedrockResponse has headers, but they are not
    // in the list of `response.headers.<vendor_specific_headers>`,
    // still include them?
  }

  setTotalTokens(agent, input, totalTokenCount) {
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
