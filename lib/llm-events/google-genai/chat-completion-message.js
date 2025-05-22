/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
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
    this.is_response = response?.candidates?.[0]?.content?.parts?.[0]?.text === message?.content

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = message?.content
    }

    if (this.is_response) {
      this.token_count = response.candidatesTokenCount
    } else {
      this.token_count = response.promptTokenCount
    }
  }
}
