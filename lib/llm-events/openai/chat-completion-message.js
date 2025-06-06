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

    // Determine if the response is from the chat completion API or the response API
    const isResponseAPI = response?.object === 'response'
    let isResponse = false
    if (isResponseAPI) {
      isResponse = message.content?.[0]?.text === response?.output?.[0]?.content?.[0]?.text
      if (!isResponse && !this.role) this.role = 'user'
    } else {
      isResponse = response?.choices?.[0]?.message?.content === message?.content
    }
    this.is_response = isResponse

    // Assign content to the event
    let content
    if (agent.config.ai_monitoring.record_content.enabled === true) {
      if (isResponseAPI) {
        content = isResponse ? message?.content?.[0]?.text : (message.content ?? message)
      } else {
        content = message?.content
      }
      this.content = content
    }

    // Calculate token count if the callback is available
    const tokenCB = agent.llm?.tokenCountCallback
    if (typeof tokenCB !== 'function') return

    const model = isResponse ? this['response.model'] : (request.model || request.engine)
    this.token_count = tokenCB(model, content)
  }
}
