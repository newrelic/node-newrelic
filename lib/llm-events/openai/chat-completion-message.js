/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')

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
    this.id = `${response.id}-${index}`
    this.role = message?.role
    this.sequence = index
    this.completion_id = completionId
    this.is_response = response?.choices?.[0]?.message?.content === message?.content

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = message?.content
    }

    const tokenCB = agent.llm?.tokenCountCallback
    if (typeof tokenCB !== 'function') {
      return
    }

    if (this.is_response) {
      this.token_count = tokenCB(this['response.model'], message?.content)
    } else {
      this.token_count = tokenCB(request.model || request.engine, message?.content)
    }
  }
}
