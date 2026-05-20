/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MongoOperationSubscriber = require('./operation')

/**
 * Subscriber for synchronous MongoDB operation methods (e.g. `Db.collection()`,
 * which returns a Collection object without an async phase).
 *
 * Uses the `end` event instead of `asyncEnd` since there is no async phase.
 */
class MongoSyncOperationSubscriber extends MongoOperationSubscriber {
  constructor(opts) {
    super(opts)
    this.events = ['end']
  }
}

module.exports = MongoSyncOperationSubscriber
