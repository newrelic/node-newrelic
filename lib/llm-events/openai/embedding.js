/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LlmEmbedding = require('../embedding')
const getUsageTokens = require('./get-usage-tokens')

/**
 * @augments LlmEmbedding
 * Encapsulates an OpenAI `LlmEmbedding` event.
 */
module.exports = class OpenAiLlmEmbedding extends LlmEmbedding {
  constructor({ agent, segment, transaction, request = {}, response = {}, error = null }) {
    super({ agent,
      segment,
      transaction,
      requestId: response?.headers?.['x-request-id'],
      requestInput: request?.input?.toString(),
      requestModel: request?.model || request?.engine,
      responseModel: response?.model,
      responseOrg: response?.headers?.['openai-organization'],
      vendor: 'openai',
      error })

    this.setTotalTokens(agent, request, response)
    if (response.headers) {
      // Set response.headers.*
      this['response.headers.llmVersion'] = response.headers['openai-version']
      this['response.headers.ratelimitLimitRequests'] = response.headers['x-ratelimit-limit-requests']
      this['response.headers.ratelimitLimitTokens'] = response.headers['x-ratelimit-limit-tokens']
      this['response.headers.ratelimitResetTokens'] = response.headers['x-ratelimit-reset-tokens']
      this['response.headers.ratelimitRemainingTokens'] = response.headers['x-ratelimit-remaining-tokens']
      this['response.headers.ratelimitRemainingRequests'] = response.headers['x-ratelimit-remaining-requests']
    }
  }

  setTotalTokens(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    // For embedding events, only total token count is relevant.
    // Prefer callback for total tokens; if unavailable, fall back to response data.
    if (tokenCB) {
      const content = request.input?.toString()

      if (content === undefined) {
        return
      }

      this.totalTokenCount = this.calculateCallbackTokens(tokenCB, this['request.model'], content)
      return
    }

    const { totalTokens } = getUsageTokens(response)
    this.totalTokenCount = totalTokens
  }
}
