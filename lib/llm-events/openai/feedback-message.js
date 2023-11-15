/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { makeId } = require('../../util/hashes')

module.exports = class LlmFeedbackMessage {
  constructor(opts) {
    this.id = makeId(32)
    this.conversation_id = opts.conversationId
    this.request_id = opts.requestId
    this.message_id = opts.messageId
    this.category = opts.category
    this.rating = opts.rating
    this.message = opts.message
    this.ingest_source = 'Node'
  }
}
