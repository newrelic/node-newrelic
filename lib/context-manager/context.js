/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = class Context {
  constructor(transaction, segment) {
    this._transaction = transaction
    this._segment = segment
  }

  get segment() {
    return this._segment
  }

  get transaction() {
    return this._transaction
  }

  enterSegment({ segment, transaction = this.transaction }) {
    return new this.constructor(transaction, segment)
  }

  enterTransaction(transaction) {
    return new this.constructor(transaction, transaction.trace.root)
  }
}
