/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { makeId } = require('../util/hashes')

module.exports = class LlmFeedbackMessage {
  constructor(opts) {
    this.id = makeId(32)
    this.trace_id = opts.traceId
    this.category = opts.category
    this.rating = opts.rating
    this.message = opts.message
    this.ingest_source = 'Node'
  }
}
