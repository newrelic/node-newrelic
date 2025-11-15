/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')

module.exports = class LlmEmbedding extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, withError = false, transaction }) {
    super({ agent, segment, request, response, responseAttrs: true, transaction })
    this.error = withError

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.input = request.input?.toString()
    }

    this.setTotalTokens(agent, request, response)
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

      const totalTokens = this.calculateCallbackTokens(tokenCB, this['request.model'], content)
      this.setTokensOnEmbeddingMessage(totalTokens)
      return
    }

    const { totalTokens } = this.getUsageTokens(response)
    this.setTokensOnEmbeddingMessage(totalTokens)
  }
}
