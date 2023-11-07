/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { makeId } = require('../../util/hashes')

module.exports = class LlmFeedbackMessage {
  constructor(opts) {
    this.id = makeId(32)
    this.conversation_id = opts.conversation_id
    this.request_id = opts.request_id
    this.message_id = opts.message_id
    this.category = opts.category
    this.rating = opts.category
    this.message = opts.message
    this.ingest_source = 'Node'
  }

  serialize() {
    return JSON.stringify(this, (_, v) => v || '')
  }
}
