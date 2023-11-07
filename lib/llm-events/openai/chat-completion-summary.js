/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')

module.exports = class LlmChatCompletionSummary extends LlmEvent {
  constructor(agent, request = {}, response = {}) {
    super({ agent, request, response, responseAttrs: true })
    this.conversation_id = this.conversationId()
    this['request.max_tokens'] = request.max_tokens
    this['request.temperature'] = request.temperature
    this['response.number_of_messages'] = request?.messages?.length + response?.choices?.length
    this['response.usage.completion_tokens'] = response?.usage?.completion_tokens
    this['response.choices.finish_reason'] = response?.choices?.[0]?.finish_reason
  }
}
