/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')
const { validCallbackTokenCount, calculateCallbackTokens } = require('../utils')

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

      const totalTokenCount = calculateCallbackTokens(tokenCB, this['request.model'], content)
      const hasValidCallbackCounts = validCallbackTokenCount(totalTokenCount)

      if (hasValidCallbackCounts) {
        this['response.usage.total_tokens'] = Number(totalTokenCount)
      }
      return
    }

    const totalTokens = this.getTotalTokens(response)
    if (totalTokens) {
      this['response.usage.total_tokens'] = Number(totalTokens)
    }
  }

  getTotalTokens(response) {
    return response?.usage?.total_tokens || response?.usage?.totalTokens
  }
}
