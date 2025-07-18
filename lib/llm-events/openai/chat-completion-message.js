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
    message = { content: undefined, role: undefined },
    completionId,
    transaction
  }) {
    super({ agent, segment, request, response, transaction })
    this.id = `${response.id}-${index}`
    this.role = message?.role
    this.sequence = index
    this.completion_id = completionId

    // Check if the given message is from the response.
    // The response object differs based on the API called.
    // If it's `responses.create`, we check against `response.output`.
    // If it's `chat.completions.create` or langchain, we check against `response.choices`.
    if (response?.object === 'response') {
      this.is_response = message.content === response?.output?.[0]?.content?.[0]?.text
    } else {
      this.is_response = message.content === response?.choices?.[0]?.message?.content
    }

    // Assign content to the event.
    const content = message?.content
    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = content
    }

    // Calculate token count if the callback is available.
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
