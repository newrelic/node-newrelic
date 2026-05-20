/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MongoQuerySubscriber = require('./query')

/**
 * Subscriber for synchronous MongoDB query operations that return a cursor
 * rather than a Promise (e.g. `Collection.aggregate()`).
 *
 * Uses the `end` event (fires synchronously after the function returns) instead
 * of `asyncEnd` since there is no async phase for these cursor-factory methods.
 */
class MongoSyncQuerySubscriber extends MongoQuerySubscriber {
  constructor(opts) {
    super(opts)
    this.events = ['end']
  }
}

module.exports = MongoSyncQuerySubscriber
