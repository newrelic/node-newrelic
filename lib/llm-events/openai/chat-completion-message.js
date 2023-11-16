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
    this.conversation_id = this.conversationId(agent)
    this.content = message?.content
    this.role = message?.role
    this.sequence = index
    this.completion_id = completionId
    this.is_response = response?.choices?.[0]?.message?.content === this.content
  }
}
