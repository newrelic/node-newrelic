/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')

module.exports = class LlmChatCompletionSummary extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, withError = false, transaction }) {
    super({ agent, segment, request, response, responseAttrs: true, transaction })
    this.error = withError
    let requestMessagesLength = 0
    if (Array.isArray(request?.contents)) {
      requestMessagesLength = request.contents.length
    } else if (typeof request?.contents === 'string') {
      requestMessagesLength = 1
    }
    this['response.number_of_messages'] = requestMessagesLength + (response?.candidates?.length || 0)
    this['response.choices.finish_reason'] = response?.candidates?.[0]?.finishReason
    this['request.max_tokens'] = request.config?.maxOutputTokens
    this['request.temperature'] = request.config?.temperature
  }
}
