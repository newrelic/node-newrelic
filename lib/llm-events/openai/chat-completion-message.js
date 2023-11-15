/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const LlmEvent = require('./event')
const { makeId } = require('../../util/hashes')

module.exports = class LlmChatCompletionMessage extends LlmEvent {
  constructor({ agent, segment, request = {}, response = {}, index = 0 }) {
    super({ agent, segment, request, response })
    this.id = `${response.id}-${index}`
    this.conversation_id = this.conversationId(agent)
    this.content = request?.messages?.[index]?.content
    this.role = request?.messages?.[index]?.role
    this.sequence = index
    this.completion_id = makeId(36)
  }
}
