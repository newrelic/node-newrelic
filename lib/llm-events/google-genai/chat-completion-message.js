/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')
const { makeId } = require('../../util/hashes')
const { tokenUsageAttributesExist } = require('./utils')
const { validCallbackTokenCount } = require('../utils')

module.exports = class LlmChatCompletionMessage extends LlmEvent {
  constructor({
    agent,
    segment,
    request = {},
    response = {},
    index = 0,
    message,
    completionId,
    transaction
  }) {
    super({ agent, segment, request, response, transaction })
    this.id = makeId(36)
    // message?.role is only defined if the message is
    // a response and it is always 'model'.
    // request messages do not have a role
    this.role = message?.role ?? 'user'
    this.sequence = index
    this.completion_id = completionId
    const responseText = response?.text ?? response?.candidates?.[0]?.content?.parts?.[0]?.text
    this.is_response = responseText === message?.parts?.[0]?.text

    const content = this.is_response ? message?.parts?.[0]?.text : message
    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = content
    }
    this.calculateTokenCount(agent, request, response, content)
  }

  calculateTokenCount(agent, request, response, content) {
    const tokenCB = agent.llm?.tokenCountCallback

    if (this.is_response && typeof tokenCB === 'function') {
      const tokenCount = tokenCB(this['response.model'], content)
      if (validCallbackTokenCount(tokenCount)) {
        this.token_count = tokenCount
      }
      return
    }

    if (typeof tokenCB === 'function') {
      const tokenCount = tokenCB(request.model, content)
      if (validCallbackTokenCount(tokenCount)) {
        this.token_count = tokenCount
      }
      return
    }

    // If no token count callback is available, we need to check the response object
    // for usage information and set token_count to 0 if all usage attributes are present.
    // Response headers won't have token usage information
    if (tokenUsageAttributesExist(response)) {
      this.token_count = 0
    }
  }
}
