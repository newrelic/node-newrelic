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
    super({ agent, segment, request, response, transaction, eventType: 'chat-completion-message' })
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
    // Calculate token count if record_content is enabled.
    const content = message?.content
    if (agent.config.ai_monitoring.record_content.enabled === true) {
      this.content = content
      this.calculateTokenCount(agent, request, response)
    }
  }

  calculateTokenCount(agent, request, response) {
    const tokenCB = agent.llm?.tokenCountCallback

    if (this.is_response && tokenCB) {
      const tokenValue = tokenCB(this['response.model'], this.content)
      if (this.validCallbackTokenValue(tokenValue)) {
        this.token_count = tokenValue
      }
    } else if (tokenCB) {
      const tokenValue = tokenCB(request.model || request.engine, this.content)
      if (this.validCallbackTokenValue(tokenValue)) {
        this.token_count = tokenValue
      }
    } else {
      // If no token count callback is available, we need to check the response object or
      // headers for usage information and set token_count to 0 if all usage attributes
      // are present.
      if (this.tokenUsageAttrResp(response) || this.tokenUsageInResponseHeaders()) {
        this.token_count = 0
      }
    }
  }

  // all 3 usage attributes must be available in order to add token_count
  tokenUsageAttrResp(response) {
    return (response?.usage?.completion_tokens && response?.usage?.prompt_tokens && response?.usage?.total_tokens)
  }

  tokenUsageInResponseHeaders() {
    // TODO: what are the headers for the usage tokens info
    // temp return false
    return false
  }

  // value is valid when it's greater than 0 or not null
  validCallbackTokenValue(tokenValue) {
    return tokenValue > 0 || !tokenValue
  }
}
