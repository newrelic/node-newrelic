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

    // req and res are structured differently depending on
    // if it was `chat.completions.create` or `responses.create`
    // that was called
    if (response?.object === 'response') {
      // `responses.create` logic
      this.is_response = message?.content?.[0]?.text === response?.output_text
      if (!this.is_response) this.role = 'user'
    } else {
      // `chat.completions.create` logic
      this.is_response = response?.choices?.[0]?.message?.content === message?.content
    }

    let content
    if (agent.config.ai_monitoring.record_content.enabled === true) {
      if (response?.object === 'response') {
        // `responses.create` logic
        if (this.is_response) content = message?.content?.[0]?.text
        else content = message
      } else content = message?.content // `chat.completions.create` logic
      this.content = content
    }

    const tokenCB = agent.llm?.tokenCountCallback
    if (typeof tokenCB !== 'function') {
      return
    }

    if (this.is_response) {
      this.token_count = tokenCB(this['response.model'], content)
    } else {
      this.token_count = tokenCB(request.model || request.engine, content)
    }
  }
}
