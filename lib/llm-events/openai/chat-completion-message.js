/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')

module.exports = class LlmChatCompletionMessage extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, index = 0, message, completionId }) {
    super({ agent, segment, request, response })
    this.id = `${response.id}-${index}`
    this.role = message?.role
    this.sequence = index
    this.completion_id = completionId
    this.is_response = response?.choices?.[0]?.message?.content === message?.content

    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = message?.content
    }

    if (this.is_response) {
      this.token_count =
        response?.usage?.completion_tokens ||
        agent.llm?.tokenCountCallback?.(this['response.model'], message?.content)
    } else {
      this.token_count =
        response?.usage?.prompt_tokens ||
        agent.llm?.tokenCountCallback?.(request.model || request.engine, message?.content)
    }
  }
}
